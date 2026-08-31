/**
 * A Vocabulary's optional description.
 *
 * Requires the vocabulary-description migration to be applied.
 */
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = {
  id: string;
  name: string;
  description: string;
  displayName: string;
};

async function createVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  name: string,
) {
  const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
    accessToken,
    body: { name },
  });
  expect(created.status).toBe(201);
  return created.body.vocabulary;
}

describe("Vocabulary description", () => {
  it("starts blank, is editable by a Manager, and persists", async () => {
    const app = testApp();
    const user = await createTestUser();
    const vocabulary = await createVocabulary(app, user.accessToken, "Core words");

    expect(vocabulary.description).toBe("");

    const patched = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      {
        method: "PATCH",
        accessToken: user.accessToken,
        body: { description: "A 60-cell core board for early literacy." },
      },
    );
    expect(patched.status).toBe(200);
    expect(patched.body.vocabulary.description).toBe(
      "A 60-cell core board for early literacy.",
    );

    const reloaded = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { accessToken: user.accessToken },
    );
    expect(reloaded.body.vocabulary.description).toBe(
      "A 60-cell core board for early literacy.",
    );
  });

  it("can be edited independently of the name, in either direction", async () => {
    const app = testApp();
    const user = await createTestUser();
    const vocabulary = await createVocabulary(app, user.accessToken, "Original");

    const describedOnly = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { method: "PATCH", accessToken: user.accessToken, body: { description: "Just a blurb" } },
    );
    expect(describedOnly.body.vocabulary.name).toBe("Original");
    expect(describedOnly.body.vocabulary.description).toBe("Just a blurb");

    const renamedOnly = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { method: "PATCH", accessToken: user.accessToken, body: { name: "Renamed" } },
    );
    expect(renamedOnly.body.vocabulary.name).toBe("Renamed");
    expect(renamedOnly.body.vocabulary.description).toBe("Just a blurb");
  });

  it("may be blanked again", async () => {
    const app = testApp();
    const user = await createTestUser();
    const vocabulary = await createVocabulary(app, user.accessToken, "Blankable");

    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: "Something" },
    });
    const cleared = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { method: "PATCH", accessToken: user.accessToken, body: { description: "" } },
    );
    expect(cleared.body.vocabulary.description).toBe("");
  });

  it("rejects a patch that names neither field", async () => {
    const app = testApp();
    const user = await createTestUser();
    const vocabulary = await createVocabulary(app, user.accessToken, "Untouched");

    const empty = await apiJson<{ error: string }>(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: {},
    });
    expect(empty.status).toBe(400);
  });

  it("cannot be edited by a User who does not manage the Vocabulary", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken, "Private");

    const attempt = await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: stranger.accessToken,
      body: { description: "Not mine to write" },
    });
    expect(attempt.status).toBe(404);

    const reloaded = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { accessToken: owner.accessToken },
    );
    expect(reloaded.body.vocabulary.description).toBe("");
  });

  it("comes across when a Vocabulary is duplicated", async () => {
    const app = testApp();
    const user = await createTestUser();
    const vocabulary = await createVocabulary(app, user.accessToken, "Source");
    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: "Carried across" },
    });

    const duplicated = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}/duplicate`,
      { accessToken: user.accessToken, body: { name: "Copy of Source" } },
    );
    expect(duplicated.status).toBe(201);
    expect(duplicated.body.vocabulary.description).toBe("Carried across");
  });

  it("is not exposed through a Vocabulary Share Link", async () => {
    const app = testApp();
    const user = await createTestUser();
    const vocabulary = await createVocabulary(app, user.accessToken, "Shared");
    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: "Private blurb" },
    });

    const link = await apiJson<{ shareLink: { token: string } }>(
      app,
      `/vocabularies/${vocabulary.id}/share-link`,
      { method: "POST", accessToken: user.accessToken },
    );
    expect(link.status).toBe(201);

    const shared = await apiJson<Record<string, unknown>>(
      app,
      `/shared/${link.body.shareLink.token}`,
    );
    expect(shared.status).toBe(200);
    expect(JSON.stringify(shared.body)).not.toContain("Private blurb");
  });
});
