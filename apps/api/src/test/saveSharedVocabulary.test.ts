import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.js";

type Vocabulary = { id: string; name: string; displayName: string };
type ShareLink = { token: string };
type Board = { id: string; name: string; displayName: string };

async function createVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  name = "Source",
) {
  const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
    method: "POST",
    accessToken,
    body: { name },
  });
  expect(created.status).toBe(201);
  return created.body.vocabulary;
}

async function apply(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  vocabularyId: string,
  mutations: unknown[],
) {
  const submitted = await apiJson(app, `/vocabularies/${vocabularyId}/change-sets`, {
    method: "POST",
    accessToken,
    body: { status: "applied", mutations },
  });
  expect(submitted.status).toBe(201);
}

function share(app: ReturnType<typeof testApp>, accessToken: string, vocabularyId: string) {
  return apiJson<{ shareLink: ShareLink }>(app, `/vocabularies/${vocabularyId}/share-link`, {
    method: "POST",
    accessToken,
  });
}

function readShared(app: ReturnType<typeof testApp>, token: string) {
  return apiJson<{
    content: {
      boards: Board[];
      buttonsByBoardId: Record<string, unknown[]>;
      paletteColors: unknown[];
      snippetInclusions: unknown[];
    };
  }>(app, `/shared/${token}`);
}

/** What the Visitor could see, in the shape a save sends. */
function snapshotOf(content: {
  boards: Board[];
  buttonsByBoardId: Record<string, unknown[]>;
  paletteColors: unknown[];
  snippetInclusions: unknown[];
}) {
  return {
    boards: content.boards,
    buttons: Object.values(content.buttonsByBoardId).flat(),
    palette_colors: content.paletteColors,
    snippet_inclusions: content.snippetInclusions,
  };
}

function saveShared(
  app: ReturnType<typeof testApp>,
  token: string,
  accessToken: string,
  name: string,
  snapshot: unknown,
) {
  return apiJson<{ vocabulary: Vocabulary; error?: string }>(app, `/shared/${token}/save`, {
    method: "POST",
    accessToken,
    body: { name, snapshot },
  });
}

describe("Keeping a shared Vocabulary", () => {
  it("becomes an independent Vocabulary the saver alone manages", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const visitor = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken, "Given away");
    const homeId = randomUUID();
    await apply(app, owner.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_button", id: randomUUID(), board_id: homeId, row_index: 0, col_index: 0, label: "more" },
    ]);
    const minted = await share(app, owner.accessToken, vocabulary.id);
    const seen = await readShared(app, minted.body.shareLink.token);

    const saved = await saveShared(
      app,
      minted.body.shareLink.token,
      visitor.accessToken,
      "Mine now",
      snapshotOf(seen.body.content),
    );

    expect(saved.status).toBe(201);
    expect(saved.body.vocabulary.id).not.toBe(vocabulary.id);
    expect(saved.body.vocabulary.displayName).toBe("Mine now");

    const managers = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${saved.body.vocabulary.id}/managers`,
      { accessToken: visitor.accessToken },
    );
    expect(managers.body.managers.map((m) => m.userId)).toEqual([visitor.userId]);
  });

  it("lets the saver communicate with what they kept", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const visitor = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken);
    await apply(app, owner.accessToken, vocabulary.id, [
      { op: "create_board", id: randomUUID(), name: "Home", width: 4, height: 3 },
    ]);
    const minted = await share(app, owner.accessToken, vocabulary.id);
    const seen = await readShared(app, minted.body.shareLink.token);
    const saved = await saveShared(
      app,
      minted.body.shareLink.token,
      visitor.accessToken,
      "Kept",
      snapshotOf(seen.body.content),
    );

    const live = await apiJson(app, `/vocabularies/${saved.body.vocabulary.id}/live`, {
      accessToken: visitor.accessToken,
    });

    expect(live.status).toBe(200);
  });

  it("keeps the Visitor's own edits, not just what the source holds", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const visitor = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken);
    const homeId = randomUUID();
    await apply(app, owner.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
    ]);
    const minted = await share(app, owner.accessToken, vocabulary.id);
    const seen = await readShared(app, minted.body.shareLink.token);

    // The Visitor renamed the Board and added one of their own.
    const edited = snapshotOf(seen.body.content);
    edited.boards = [
      { ...edited.boards[0], name: "Renamed by the Visitor" },
      {
        id: randomUUID(),
        vocabulary_id: vocabulary.id,
        name: "Theirs",
        displayName: "Theirs",
        width: 2,
        height: 2,
        kind: "board",
        created_at: "2026-08-28T00:00:00.000Z",
        updated_at: "2026-08-28T00:00:00.000Z",
      } as unknown as Board,
    ];

    const saved = await saveShared(
      app,
      minted.body.shareLink.token,
      visitor.accessToken,
      "With edits",
      edited,
    );
    const boards = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${saved.body.vocabulary.id}/boards`,
      { accessToken: visitor.accessToken },
    );

    expect(boards.body.boards.map((board) => board.name).sort()).toEqual([
      "Renamed by the Visitor",
      "Theirs",
    ]);
  });

  it("leaves the source Vocabulary untouched", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const visitor = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken, "Untouched");
    const homeId = randomUUID();
    await apply(app, owner.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
    ]);
    const minted = await share(app, owner.accessToken, vocabulary.id);
    const seen = await readShared(app, minted.body.shareLink.token);
    await saveShared(
      app,
      minted.body.shareLink.token,
      visitor.accessToken,
      "Copy",
      snapshotOf(seen.body.content),
    );

    const boards = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: owner.accessToken },
    );
    const managers = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/managers`,
      { accessToken: owner.accessToken },
    );

    expect(boards.body.boards.map((board) => board.id)).toEqual([homeId]);
    expect(managers.body.managers.map((m) => m.userId)).toEqual([owner.userId]);
  });

  it("refuses a save through a revoked link", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const visitor = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken);
    const minted = await share(app, owner.accessToken, vocabulary.id);
    const seen = await readShared(app, minted.body.shareLink.token);
    await apiJson(app, `/vocabularies/${vocabulary.id}/share-link`, {
      method: "DELETE",
      accessToken: owner.accessToken,
    });

    const saved = await saveShared(
      app,
      minted.body.shareLink.token,
      visitor.accessToken,
      "Too late",
      snapshotOf(seen.body.content),
    );

    expect(saved.status).toBe(404);
  });

  it("refuses a save with no account at all", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken);
    const minted = await share(app, owner.accessToken, vocabulary.id);

    const saved = await apiJson(app, `/shared/${minted.body.shareLink.token}/save`, {
      method: "POST",
      body: { name: "Anonymous", snapshot: { boards: [], buttons: [], palette_colors: [], snippet_inclusions: [] } },
    });

    expect(saved.status).toBe(401);
  });

  it("lets a Manager of the source keep their own separate copy", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken, "Own it");
    await apply(app, owner.accessToken, vocabulary.id, [
      { op: "create_board", id: randomUUID(), name: "Home", width: 4, height: 3 },
    ]);
    const minted = await share(app, owner.accessToken, vocabulary.id);
    const seen = await readShared(app, minted.body.shareLink.token);

    const saved = await saveShared(
      app,
      minted.body.shareLink.token,
      owner.accessToken,
      "My second one",
      snapshotOf(seen.body.content),
    );

    expect(saved.status).toBe(201);
    expect(saved.body.vocabulary.id).not.toBe(vocabulary.id);
  });
});
