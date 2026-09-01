/**
 * Browsing and searching the Gallery.
 *
 * Requires the publications migration to be applied. The Gallery is global, so
 * every assertion here is scoped to slugs this test created.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.js";

type Listing = {
  slug: string;
  title: string;
  description: string;
  attribution: string;
  publishedAt: string;
  figures: { boardCount: number; buttonCount: number; minColumns: number; maxColumns: number };
};

const app = testApp();

async function publishVocabulary(
  accessToken: string,
  name: string,
  description: string,
  attribution = "",
) {
  const created = await apiJson<{ vocabulary: { id: string } }>(app, "/vocabularies", {
    accessToken,
    body: { name },
  });
  const id = created.body.vocabulary.id;
  await apiJson(app, `/vocabularies/${id}`, {
    method: "PATCH",
    accessToken,
    body: { description },
  });
  await apiJson(app, `/vocabularies/${id}/change-sets`, {
    accessToken,
    body: {
      status: "applied",
      mutations: [
        { op: "create_board", id: randomUUID(), name: "Home", width: 4, height: 3 },
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
        attribution,
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

const browse = (query?: string) =>
  apiJson<{ publications: Listing[] }>(
    app,
    query === undefined ? "/gallery" : `/gallery?q=${encodeURIComponent(query)}`,
  );

describe("The Gallery index", () => {
  it("lists a published Vocabulary anonymously, with the figures it was published with", async () => {
    const user = await createTestUser();
    const marker = randomUUID().slice(0, 8);
    const { slug } = await publishVocabulary(
      user.accessToken,
      `Kitchen Words ${marker}`,
      "Everyday words for cooking together.",
      "Riverside SLP Team",
    );

    // No access token: browsing is anonymous.
    const listed = await browse();
    expect(listed.status).toBe(200);

    const mine = listed.body.publications.find((entry) => entry.slug === slug);
    expect(mine).toBeDefined();
    expect(mine!.title).toBe(`Kitchen Words ${marker}`);
    expect(mine!.description).toBe("Everyday words for cooking together.");
    expect(mine!.attribution).toBe("Riverside SLP Team");
    expect(mine!.figures.boardCount).toBe(1);
    expect(mine!.figures.minColumns).toBe(4);
  });

  it("matches a search against the title, case-insensitively", async () => {
    const user = await createTestUser();
    const marker = randomUUID().slice(0, 8);
    const { slug } = await publishVocabulary(
      user.accessToken,
      `Zebra ${marker}`,
      "Nothing notable in here.",
    );

    const found = await browse(`zebra ${marker}`.toUpperCase());
    expect(found.body.publications.map((entry) => entry.slug)).toContain(slug);
  });

  it("matches a search against the description", async () => {
    const user = await createTestUser();
    const marker = randomUUID().slice(0, 8);
    const { slug } = await publishVocabulary(
      user.accessToken,
      `Plainly Named ${marker}`,
      `A vocabulary about aardvarks ${marker}.`,
    );

    const found = await browse(`aardvarks ${marker}`);
    expect(found.body.publications.map((entry) => entry.slug)).toContain(slug);
  });

  it("returns nothing for a search that matches nothing", async () => {
    const nothing = await browse(`no-such-thing-${randomUUID()}`);
    expect(nothing.status).toBe(200);
    expect(nothing.body.publications).toEqual([]);
  });

  it("orders newest first", async () => {
    const user = await createTestUser();
    const marker = randomUUID().slice(0, 8);
    const older = await publishVocabulary(
      user.accessToken,
      `Ordering A ${marker}`,
      `Ordering probe ${marker}`,
    );
    const newer = await publishVocabulary(
      user.accessToken,
      `Ordering B ${marker}`,
      `Ordering probe ${marker}`,
    );

    const found = await browse(`Ordering probe ${marker}`);
    const slugs = found.body.publications.map((entry) => entry.slug);
    expect(slugs).toEqual([newer.slug, older.slug]);
  });

  it("does not list a Vocabulary that was never published", async () => {
    const user = await createTestUser();
    const marker = randomUUID().slice(0, 8);
    const created = await apiJson<{ vocabulary: { id: string } }>(app, "/vocabularies", {
      accessToken: user.accessToken,
      body: { name: `Unpublished ${marker}` },
    });
    await apiJson(app, `/vocabularies/${created.body.vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: `Private probe ${marker}` },
    });

    const found = await browse(`Private probe ${marker}`);
    expect(found.body.publications).toEqual([]);
  });
});
