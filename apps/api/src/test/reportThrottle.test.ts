/**
 * The Report notification throttle: at most one email an hour, and the email
 * covers every Report not yet notified rather than only the one that triggered
 * it — so throttling delays a Report without ever dropping one. See ADR 0016.
 *
 * Requires the report-claim migration to be applied.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, requireEnv, testApp } from "./helpers.js";
import { notifyPendingReports, type ReportMailer } from "../reportNotifier.js";

const app = testApp();

function service() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Records what it was asked to send, and can be told to fail. */
function recordingMailer(shouldFail = false) {
  const sent: { subject: string; body: string }[] = [];
  const mailer: ReportMailer = {
    async send(subject, body) {
      if (shouldFail) throw new Error("cloudflare is down");
      sent.push({ subject, body });
    },
  };
  return { mailer, sent };
}

async function publishVocabulary(accessToken: string, name: string) {
  const created = await apiJson<{ vocabulary: { id: string } }>(app, "/vocabularies", {
    accessToken,
    body: { name },
  });
  const id = created.body.vocabulary.id;
  await apiJson(app, `/vocabularies/${id}`, {
    method: "PATCH",
    accessToken,
    body: { description: `Description for ${name}` },
  });
  await apiJson(app, `/vocabularies/${id}/change-sets`, {
    accessToken,
    body: {
      status: "applied",
      mutations: [{ op: "create_board", id: randomUUID(), name: "Home", width: 4, height: 3 }],
    },
  });
  const state = await apiJson<{ consentTexts: { id: string; clause: string }[] }>(
    app,
    `/vocabularies/${id}/publication`,
    { accessToken },
  );
  const published = await apiJson<{ publication: { slug: string } }>(
    app,
    `/vocabularies/${id}/publish`,
    {
      accessToken,
      body: {
        confirmations: state.body.consentTexts.map((text) => ({
          clause: text.clause,
          consentTextId: text.id,
        })),
      },
    },
  );
  return published.body.publication.slug;
}

/**
 * The throttle is global by design, so testing it means controlling the last
 * hour. This ages already-notified Reports rather than clearing their marks:
 * nulling them would make them un-notified and drag them into the next
 * catch-up email, which is exactly the behaviour under test.
 */
async function quietenRecentNotifications() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await service()
    .from("publication_reports")
    .update({ notified_at: twoHoursAgo })
    .not("notified_at", "is", null);
}

describe("Report notification throttle", () => {
  it("sends once, then stays quiet for the hour, catching up the ones it skipped", async () => {
    const publisher = await createTestUser();
    const slug = await publishVocabulary(publisher.accessToken, `Throttled ${randomUUID().slice(0, 8)}`);
    await quietenRecentNotifications();

    const first = recordingMailer();
    await apiJson(app, `/gallery/${slug}/reports`, { body: { reason: "First report" } });
    const firstRun = await notifyPendingReports(service(), first.mailer, "https://example.test");
    expect(firstRun.sent).toBe(true);
    expect(first.sent).toHaveLength(1);
    expect(first.sent[0].body).toContain("First report");

    // Inside the hour: nothing goes out, and the report is not lost.
    const second = recordingMailer();
    await apiJson(app, `/gallery/${slug}/reports`, { body: { reason: "Second report" } });
    const secondRun = await notifyPendingReports(service(), second.mailer, "https://example.test");
    expect(secondRun.sent).toBe(false);
    expect(second.sent).toHaveLength(0);

    // Once the hour is up, the suppressed report is included in the catch-up.
    await quietenRecentNotifications();
    const third = recordingMailer();
    await apiJson(app, `/gallery/${slug}/reports`, { body: { reason: "Third report" } });
    const thirdRun = await notifyPendingReports(service(), third.mailer, "https://example.test");
    expect(thirdRun.sent).toBe(true);
    expect(third.sent[0].body).toContain("Second report");
    expect(third.sent[0].body).toContain("Third report");
  });

  it("stores a report even when there is no mail configured at all", async () => {
    const publisher = await createTestUser();
    const slug = await publishVocabulary(publisher.accessToken, `Unmailed ${randomUUID().slice(0, 8)}`);
    const marker = `no mail configured ${randomUUID().slice(0, 8)}`;

    const stored = await apiJson(app, `/gallery/${slug}/reports`, { body: { reason: marker } });
    expect(stored.status).toBe(201);

    // A null mailer is a logged no-op, never a failure.
    const run = await notifyPendingReports(service(), null, "https://example.test");
    expect(run.sent).toBe(false);

    const { data } = await service()
      .from("publication_reports")
      .select("reason")
      .eq("reason", marker);
    expect((data ?? []).length).toBe(1);
  });

  it("does not lose reports when the send itself fails", async () => {
    const publisher = await createTestUser();
    const slug = await publishVocabulary(publisher.accessToken, `Failing ${randomUUID().slice(0, 8)}`);
    await quietenRecentNotifications();

    const marker = `send failure ${randomUUID().slice(0, 8)}`;
    await apiJson(app, `/gallery/${slug}/reports`, { body: { reason: marker } });

    const failing = recordingMailer(true);
    const run = await notifyPendingReports(service(), failing.mailer, "https://example.test");
    expect(run.sent).toBe(false);

    // The row is the record, and it survives regardless of the mail.
    const { data } = await service()
      .from("publication_reports")
      .select("notified_at")
      .eq("reason", marker);
    const rows = (data ?? []) as { notified_at: string | null }[];
    expect(rows.length).toBe(1);

    // And it goes back to un-notified, or the throttle would have swallowed it:
    // the claim commits before the send, so a failure has to be compensated.
    expect(rows[0].notified_at).toBeNull();
  });

  it("picks up a report whose earlier send failed, on the next attempt", async () => {
    const publisher = await createTestUser();
    const slug = await publishVocabulary(publisher.accessToken, `Retried ${randomUUID().slice(0, 8)}`);
    await quietenRecentNotifications();

    const marker = `retry after failure ${randomUUID().slice(0, 8)}`;
    await apiJson(app, `/gallery/${slug}/reports`, { body: { reason: marker } });

    const failing = recordingMailer(true);
    await notifyPendingReports(service(), failing.mailer, "https://example.test");

    const working = recordingMailer();
    const retry = await notifyPendingReports(service(), working.mailer, "https://example.test");
    expect(retry.sent).toBe(true);
    expect(working.sent[0].body).toContain(marker);
  });
});
