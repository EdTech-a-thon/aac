/**
 * What accumulates against a Publication: Endorsements, Copies, Reports, and
 * withdrawal.
 *
 * Requires the publications, engagement, and report-claim migrations.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

const app = testApp();

type Published = { id: string; slug: string };

async function publishVocabulary(accessToken: string, name: string): Promise<Published> {
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
  const homeId = randomUUID();
  await apiJson(app, `/vocabularies/${id}/change-sets`, {
    accessToken,
    body: {
      status: "applied",
      mutations: [
        { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
        {
          op: "create_button",
          id: randomUUID(),
          board_id: homeId,
          row_index: 0,
          col_index: 0,
          label: "more",
        },
      ],
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
  expect(published.status).toBe(201);
  return { id, slug: published.body.publication.slug };
}

const endorse = (accessToken: string, slug: string, standing: boolean) =>
  apiJson<{ standing: boolean; count: number; error?: string }>(
    app,
    `/gallery/${slug}/endorsement`,
    { accessToken, body: { standing } },
  );

const detail = (slug: string, accessToken?: string) =>
  apiJson<{
    publication: { endorsementCount: number; youEndorsed: boolean };
    error?: string;
  }>(app, `/gallery/${slug}`, { accessToken });

const publicationState = (accessToken: string, id: string) =>
  apiJson<{
    publication: {
      slug: string;
      published: boolean;
      drifted: boolean;
      copyCount: number;
      currentVersion: { seq: number } | null;
    } | null;
  }>(app, `/vocabularies/${id}/publication`, { accessToken });

describe("Endorsements", () => {
  it("toggles, counts only what stands, and never exposes who endorsed", async () => {
    const publisher = await createTestUser();
    const supporter = await createTestUser();
    const { slug } = await publishVocabulary(publisher.accessToken, `Endorsable ${randomUUID().slice(0, 8)}`);

    expect((await detail(slug)).body.publication.endorsementCount).toBe(0);

    const on = await endorse(supporter.accessToken, slug, true);
    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ standing: true, count: 1 });

    // Toggling on twice is still one Endorsement.
    expect((await endorse(supporter.accessToken, slug, true)).body.count).toBe(1);

    const mine = await detail(slug, supporter.accessToken);
    expect(mine.body.publication.youEndorsed).toBe(true);

    const anonymous = await detail(slug);
    expect(anonymous.body.publication.endorsementCount).toBe(1);
    expect(anonymous.body.publication.youEndorsed).toBe(false);
    expect(JSON.stringify(anonymous.body)).not.toContain(supporter.userId);

    const off = await endorse(supporter.accessToken, slug, false);
    expect(off.body).toMatchObject({ standing: false, count: 0 });
    expect((await detail(slug, supporter.accessToken)).body.publication.youEndorsed).toBe(false);

    // Endorsing again after withdrawing works and counts once.
    expect((await endorse(supporter.accessToken, slug, true)).body.count).toBe(1);
  });

  it("refuses to let a Manager endorse their own Publication", async () => {
    const publisher = await createTestUser();
    const { slug } = await publishVocabulary(publisher.accessToken, `Self ${randomUUID().slice(0, 8)}`);

    const attempt = await endorse(publisher.accessToken, slug, true);
    expect(attempt.status).toBe(400);
    expect((await detail(slug)).body.publication.endorsementCount).toBe(0);
  });

  it("survives republishing", async () => {
    const publisher = await createTestUser();
    const supporter = await createTestUser();
    const { id, slug } = await publishVocabulary(
      publisher.accessToken,
      `Republished ${randomUUID().slice(0, 8)}`,
    );
    await endorse(supporter.accessToken, slug, true);

    const state = await apiJson<{ consentTexts: { id: string; clause: string }[] }>(
      app,
      `/vocabularies/${id}/publication`,
      { accessToken: publisher.accessToken },
    );
    await apiJson(app, `/vocabularies/${id}/publish`, {
      accessToken: publisher.accessToken,
      body: {
        confirmations: state.body.consentTexts.map((text) => ({
          clause: text.clause,
          consentTextId: text.id,
        })),
      },
    });

    expect((await detail(slug)).body.publication.endorsementCount).toBe(1);
  });

  it("needs an account", async () => {
    const publisher = await createTestUser();
    const { slug } = await publishVocabulary(publisher.accessToken, `Guarded ${randomUUID().slice(0, 8)}`);
    const attempt = await apiJson(app, `/gallery/${slug}/endorsement`, { body: { standing: true } });
    expect(attempt.status).toBe(401);
  });
});

describe("Copying a Publication", () => {
  it("creates an independent Vocabulary, records the Copy, and remembers the origin", async () => {
    const publisher = await createTestUser();
    const copier = await createTestUser();
    const { id, slug } = await publishVocabulary(
      publisher.accessToken,
      `Copyable ${randomUUID().slice(0, 8)}`,
    );

    const copied = await apiJson<{ vocabulary: { id: string; name: string } }>(
      app,
      `/gallery/${slug}/copy`,
      { accessToken: copier.accessToken, body: {} },
    );
    expect(copied.status).toBe(201);
    const copyId = copied.body.vocabulary.id;
    expect(copyId).not.toBe(id);

    // Its content came across.
    const boards = await apiJson<{ boards: { name: string }[] }>(
      app,
      `/vocabularies/${copyId}/boards`,
      { accessToken: copier.accessToken },
    );
    expect(boards.body.boards.map((board) => board.name)).toEqual(["Home"]);

    // The copier is its sole Manager; the publisher has no access at all.
    const publisherLook = await apiJson(app, `/vocabularies/${copyId}`, {
      accessToken: publisher.accessToken,
    });
    expect(publisherLook.status).toBe(404);

    // The copy remembers where it came from, and its Managers can see that.
    const detailForCopier = await apiJson<{ origin: { slug: string; seq: number } | null }>(
      app,
      `/vocabularies/${copyId}`,
      { accessToken: copier.accessToken },
    );
    expect(detailForCopier.body.origin).toMatchObject({ slug, seq: 1 });

    // The publisher sees the count, and nothing about who copied.
    const state = await publicationState(publisher.accessToken, id);
    expect(state.body.publication!.copyCount).toBe(1);
    expect(JSON.stringify(state.body)).not.toContain(copier.userId);
  });

  it("counts each copy, including repeats by the same person", async () => {
    const publisher = await createTestUser();
    const copier = await createTestUser();
    const { id, slug } = await publishVocabulary(
      publisher.accessToken,
      `Twice Copied ${randomUUID().slice(0, 8)}`,
    );

    const first = await apiJson<{ vocabulary: { id: string } }>(app, `/gallery/${slug}/copy`, {
      accessToken: copier.accessToken,
      body: {},
    });
    const second = await apiJson<{ vocabulary: { id: string } }>(app, `/gallery/${slug}/copy`, {
      accessToken: copier.accessToken,
      body: {},
    });
    expect(first.body.vocabulary.id).not.toBe(second.body.vocabulary.id);

    const state = await publicationState(publisher.accessToken, id);
    expect(state.body.publication!.copyCount).toBe(2);
  });

  it("needs an account", async () => {
    const publisher = await createTestUser();
    const { slug } = await publishVocabulary(publisher.accessToken, `NoAnon ${randomUUID().slice(0, 8)}`);
    const attempt = await apiJson(app, `/gallery/${slug}/copy`, { body: {} });
    expect(attempt.status).toBe(401);
  });
});

describe("Withdrawing and republishing", () => {
  it("delists without deleting, and resumes the same Publication when published again", async () => {
    const publisher = await createTestUser();
    const supporter = await createTestUser();
    const copier = await createTestUser();
    const { id, slug } = await publishVocabulary(
      publisher.accessToken,
      `Withdrawable ${randomUUID().slice(0, 8)}`,
    );
    await endorse(supporter.accessToken, slug, true);
    const copied = await apiJson<{ vocabulary: { id: string } }>(app, `/gallery/${slug}/copy`, {
      accessToken: copier.accessToken,
      body: {},
    });

    const withdrawn = await apiJson(app, `/vocabularies/${id}/publish`, {
      method: "DELETE",
      accessToken: publisher.accessToken,
    });
    expect(withdrawn.status).toBe(200);

    // Its page and its listing are both dead.
    expect((await detail(slug)).status).toBe(404);
    const browsed = await apiJson<{ publications: { slug: string }[] }>(app, "/gallery");
    expect(browsed.body.publications.map((entry) => entry.slug)).not.toContain(slug);

    // The copy taken before withdrawal is untouched.
    const boards = await apiJson<{ boards: { name: string }[] }>(
      app,
      `/vocabularies/${copied.body.vocabulary.id}/boards`,
      { accessToken: copier.accessToken },
    );
    expect(boards.body.boards.map((board) => board.name)).toEqual(["Home"]);

    // Its origin stops resolving while it is withdrawn, and the copy survives.
    const originGone = await apiJson<{ origin: unknown }>(
      app,
      `/vocabularies/${copied.body.vocabulary.id}`,
      { accessToken: copier.accessToken },
    );
    expect(originGone.body.origin).toBeNull();

    // Publishing again resumes the same Publication: same slug, same standing.
    const state = await apiJson<{ consentTexts: { id: string; clause: string }[] }>(
      app,
      `/vocabularies/${id}/publication`,
      { accessToken: publisher.accessToken },
    );
    const again = await apiJson<{ publication: { slug: string } }>(
      app,
      `/vocabularies/${id}/publish`,
      {
        accessToken: publisher.accessToken,
        body: {
          confirmations: state.body.consentTexts.map((text) => ({
            clause: text.clause,
            consentTextId: text.id,
          })),
        },
      },
    );
    expect(again.body.publication.slug).toBe(slug);
    expect((await detail(slug)).body.publication.endorsementCount).toBe(1);
  });

  it("reports drift only once the Vocabulary has actually changed", async () => {
    const publisher = await createTestUser();
    const { id } = await publishVocabulary(publisher.accessToken, `Drifting ${randomUUID().slice(0, 8)}`);

    expect((await publicationState(publisher.accessToken, id)).body.publication!.drifted).toBe(false);

    // A changed description alone counts, because it is captured at publish.
    await apiJson(app, `/vocabularies/${id}`, {
      method: "PATCH",
      accessToken: publisher.accessToken,
      body: { description: "Rewritten after publishing." },
    });
    expect((await publicationState(publisher.accessToken, id)).body.publication!.drifted).toBe(true);

    // Publishing again settles it.
    const state = await apiJson<{ consentTexts: { id: string; clause: string }[] }>(
      app,
      `/vocabularies/${id}/publication`,
      { accessToken: publisher.accessToken },
    );
    await apiJson(app, `/vocabularies/${id}/publish`, {
      accessToken: publisher.accessToken,
      body: {
        confirmations: state.body.consentTexts.map((text) => ({
          clause: text.clause,
          consentTextId: text.id,
        })),
      },
    });
    expect((await publicationState(publisher.accessToken, id)).body.publication!.drifted).toBe(false);

    // A content change counts too.
    await apiJson(app, `/vocabularies/${id}/change-sets`, {
      accessToken: publisher.accessToken,
      body: {
        status: "applied",
        mutations: [
          { op: "create_board", id: randomUUID(), name: "Added later", width: 2, height: 2 },
        ],
      },
    });
    expect((await publicationState(publisher.accessToken, id)).body.publication!.drifted).toBe(true);
  });

  it("does not let a non-Manager withdraw", async () => {
    const publisher = await createTestUser();
    const stranger = await createTestUser();
    const { id, slug } = await publishVocabulary(
      publisher.accessToken,
      `Defended ${randomUUID().slice(0, 8)}`,
    );

    const attempt = await apiJson(app, `/vocabularies/${id}/publish`, {
      method: "DELETE",
      accessToken: stranger.accessToken,
    });
    expect(attempt.status).toBe(404);
    expect((await detail(slug)).status).toBe(200);
  });
});

describe("Reporting a Publication", () => {
  it("stores a report from anyone, signed in or not, and needs a reason", async () => {
    const publisher = await createTestUser();
    const reporter = await createTestUser();
    const { slug } = await publishVocabulary(publisher.accessToken, `Reportable ${randomUUID().slice(0, 8)}`);

    const blank = await apiJson<{ error: string }>(app, `/gallery/${slug}/reports`, {
      body: { reason: "   " },
    });
    expect(blank.status).toBe(400);

    const anonymous = await apiJson(app, `/gallery/${slug}/reports`, {
      body: { reason: "This uses a licensed symbol set." },
    });
    expect(anonymous.status).toBe(201);

    const signedIn = await apiJson(app, `/gallery/${slug}/reports`, {
      accessToken: reporter.accessToken,
      body: { reason: "It has a child's photograph in it." },
    });
    expect(signedIn.status).toBe(201);

    // Reporting changes nothing about the Publication.
    expect((await detail(slug)).status).toBe(200);
  });

  it("does not report something that is not on the Gallery", async () => {
    const missing = await apiJson(app, `/gallery/no-such-listing-here/reports`, {
      body: { reason: "Nothing to see" },
    });
    expect(missing.status).toBe(404);
  });
});
