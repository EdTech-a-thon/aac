import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportRow = {
  id: string;
  publication_id: string;
  reporter_id: string | null;
  reason: string;
  created_at: string;
};

/**
 * How a Report notification reaches us. An interface rather than a direct call
 * because Cloudflare's outbound transactional sending is in beta, and because
 * local development must not need a Cloudflare account at all.
 */
export type ReportMailer = {
  send(subject: string, body: string): Promise<void>;
};

/**
 * Mail through Cloudflare Email Service, to a single verified destination.
 *
 * Sends to a verified destination address need no onboarded sending domain, no
 * SPF/DKIM/DMARC records, and no paid plan, and they are exempt from quotas —
 * which is exactly the shape of a Report notification, because it is addressed
 * to us. The corollary is that this channel can only ever email us: telling a
 * publisher their Vocabulary was reported would be an arbitrary recipient, and
 * needs a sending domain. See ADR 0016.
 *
 * Returns null when unconfigured, so the send becomes a logged no-op rather
 * than a crash.
 */
export function cloudflareReportMailer(): ReportMailer | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const to = process.env.REPORT_NOTIFICATION_EMAIL;
  const from = process.env.REPORT_NOTIFICATION_FROM;

  if (!accountId || !apiToken || !to || !from) return null;

  return {
    async send(subject, body) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from },
            subject,
            content: [{ type: "text/plain", value: body }],
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Cloudflare send failed: ${response.status} ${await response.text()}`,
        );
      }
    },
  };
}

export function reportEmailBody(
  reports: ReportRow[],
  slugByPublicationId: Map<string, string>,
  siteUrl: string,
): string {
  const lines = [
    reports.length === 1
      ? "One Publication has been reported."
      : `${reports.length} reports have come in.`,
    "",
  ];
  for (const report of reports) {
    const slug = slugByPublicationId.get(report.publication_id) ?? "(unknown)";
    lines.push(`${slug} — ${report.created_at}`);
    lines.push(`  ${report.reason}`);
    lines.push(`  ${siteUrl.replace(/\/$/, "")}/gallery/${slug}`);
    lines.push(
      report.reporter_id ? `  reported by ${report.reporter_id}` : "  reported anonymously",
    );
    lines.push("");
  }
  lines.push("Nothing has been taken down. Acting on these is a manual job.");
  return lines.join("\n");
}

/**
 * Send one catch-up email if the last hour had none.
 *
 * The claim is atomic in the database, so simultaneous Reports produce at most
 * one email between them. It has to commit before the mail is attempted, or two
 * callers would each see an empty last hour — so a failed send is compensated
 * rather than rolled back: the claimed Reports are released back to un-notified
 * and the next attempt picks them up. Without that, a throttle that exists to
 * delay Reports would quietly swallow them.
 */
export async function notifyPendingReports(
  supabase: SupabaseClient,
  mailer: ReportMailer | null,
  siteUrl: string,
): Promise<{ sent: boolean; reports: number }> {
  if (!mailer) {
    console.info("[reports] No mail configured; report stored, notification skipped.");
    return { sent: false, reports: 0 };
  }

  const { data, error } = await supabase.rpc("claim_report_notifications");
  if (error) {
    console.error("[reports] Could not claim reports to notify:", error.message);
    return { sent: false, reports: 0 };
  }

  const reports = (data ?? []) as ReportRow[];
  if (reports.length === 0) return { sent: false, reports: 0 };

  const publicationIds = [...new Set(reports.map((report) => report.publication_id))];
  const { data: publications } = await supabase
    .from("publications")
    .select("id, slug")
    .in("id", publicationIds);
  const slugByPublicationId = new Map(
    ((publications ?? []) as { id: string; slug: string }[]).map((row) => [row.id, row.slug]),
  );

  const subject =
    reports.length === 1
      ? "A published vocabulary was reported"
      : `${reports.length} published vocabularies were reported`;

  try {
    await mailer.send(subject, reportEmailBody(reports, slugByPublicationId, siteUrl));
    return { sent: true, reports: reports.length };
  } catch (err) {
    console.error("[reports] Could not send the report notification:", err);
    const { error: releaseError } = await supabase.rpc("release_report_notifications", {
      p_report_ids: reports.map((report) => report.id),
    });
    if (releaseError) {
      // Now they really could be missed, so say so loudly enough to act on.
      console.error(
        "[reports] Could not release reports after a failed send; they will not be re-sent:",
        releaseError.message,
      );
    }
    return { sent: false, reports: reports.length };
  }
}
