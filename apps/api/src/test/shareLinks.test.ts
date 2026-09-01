import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.js";

type Vocabulary = { id: string; name: string; displayName: string };
type ShareLink = { id: string; token: string; vocabulary_id: string; board_id: string | null };

type SharedPayload = {
  share: { kind: string; vocabulary: { id: string; displayName: string } };
  content: {
    boards: { id: string; displayName: string; kind: string }[];
    buttonsByBoardId: Record<string, { id: string; label: string }[]>;
    paletteColors: { id: string; hex: string }[];
    snippetInclusions: { id: string; host_id: string; snippet_id: string }[];
    unresolvedCopyActions: unknown[];
  };
};

async function createVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  name = "Shared",
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
  return apiJson<SharedPayload & { error?: string }>(app, `/shared/${token}`);
}

describe("Share Link for a Vocabulary", () => {
  it("lets a Manager mint a link and anyone open it without an account", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "Home set");
    const homeId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "more",
      },
    ]);

    const minted = await share(app, manager.accessToken, vocabulary.id);
    expect(minted.status).toBe(201);
    expect(minted.body.shareLink.token).toMatch(/^[0-9a-f]{64}$/);

    const opened = await readShared(app, minted.body.shareLink.token);

    expect(opened.status).toBe(200);
    expect(opened.body.share.vocabulary.displayName).toBe("Home set");
    expect(opened.body.content.boards.map((board) => board.id)).toEqual([homeId]);
    expect(opened.body.content.buttonsByBoardId[homeId]).toHaveLength(1);
    expect(opened.body.content.paletteColors.length).toBeGreaterThan(0);
  });

  it("keeps one live Share Link per Vocabulary rather than minting a second", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);

    const first = await share(app, manager.accessToken, vocabulary.id);
    const second = await share(app, manager.accessToken, vocabulary.id);

    expect(second.body.shareLink.token).toBe(first.body.shareLink.token);
    expect(second.body.shareLink.id).toBe(first.body.shareLink.id);
  });

  it("shows Change Sets applied after the link was sent", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const minted = await share(app, manager.accessToken, vocabulary.id);

    const laterId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: laterId, name: "Added later", width: 2, height: 2 },
    ]);

    const opened = await readShared(app, minted.body.shareLink.token);

    expect(opened.body.content.boards.map((board) => board.id)).toContain(laterId);
  });

  it("carries Snippets and their Snippet Inclusions through the link", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    const snippetId = randomUUID();
    const inclusionId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: snippetId, name: "Strip", width: 2, height: 1, kind: "snippet" },
      {
        op: "create_snippet_inclusion",
        id: inclusionId,
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 0,
        origin_col: 1,
      },
    ]);

    const minted = await share(app, manager.accessToken, vocabulary.id);
    const opened = await readShared(app, minted.body.shareLink.token);

    expect(opened.body.content.boards.map((board) => board.kind).sort()).toEqual([
      "board",
      "snippet",
    ]);
    expect(opened.body.content.snippetInclusions.map((inc) => inc.id)).toEqual([inclusionId]);
  });

  it("makes a revoked link dead, and a later link a different one", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const first = await share(app, manager.accessToken, vocabulary.id);

    const revoked = await apiJson(app, `/vocabularies/${vocabulary.id}/share-link`, {
      method: "DELETE",
      accessToken: manager.accessToken,
    });
    expect(revoked.status).toBe(200);

    const dead = await readShared(app, first.body.shareLink.token);
    expect(dead.status).toBe(404);

    const second = await share(app, manager.accessToken, vocabulary.id);
    expect(second.body.shareLink.token).not.toBe(first.body.shareLink.token);
    expect((await readShared(app, first.body.shareLink.token)).status).toBe(404);
    expect((await readShared(app, second.body.shareLink.token)).status).toBe(200);
  });

  it("dies with its Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const minted = await share(app, manager.accessToken, vocabulary.id);

    const deleted = await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "DELETE",
      accessToken: manager.accessToken,
    });
    expect(deleted.status).toBe(200);

    expect((await readShared(app, minted.body.shareLink.token)).status).toBe(404);
  });

  it("answers a revoked, a never-existed, and a malformed link identically", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const minted = await share(app, manager.accessToken, vocabulary.id);
    await apiJson(app, `/vocabularies/${vocabulary.id}/share-link`, {
      method: "DELETE",
      accessToken: manager.accessToken,
    });

    const revoked = await readShared(app, minted.body.shareLink.token);
    const neverExisted = await readShared(app, "b".repeat(64));
    const malformed = await readShared(app, "not-a-token");

    expect(revoked.status).toBe(404);
    expect(neverExisted.status).toBe(404);
    expect(malformed.status).toBe(404);
    expect(revoked.body.error).toBe(neverExisted.body.error);
    expect(malformed.body.error).toBe(neverExisted.body.error);
  });

  it("refuses to mint or revoke a link for a Vocabulary the caller does not manage", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);

    const minted = await share(app, outsider.accessToken, vocabulary.id);
    expect(minted.status).toBeGreaterThanOrEqual(400);

    await share(app, manager.accessToken, vocabulary.id);
    const revoked = await apiJson(app, `/vocabularies/${vocabulary.id}/share-link`, {
      method: "DELETE",
      accessToken: outsider.accessToken,
    });
    expect(revoked.status).toBeGreaterThanOrEqual(400);

    const listed = await apiJson<{ shareLink: ShareLink | null; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/share-link`,
      { accessToken: outsider.accessToken },
    );
    expect(listed.status).toBe(404);
  });

  it("keeps Unresolved Copy Actions out of what a Share Link exposes", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const minted = await share(app, manager.accessToken, vocabulary.id);

    const opened = await readShared(app, minted.body.shareLink.token);

    expect(opened.body.content.unresolvedCopyActions).toEqual([]);
  });

  it("is not carried into a duplicate of the Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "Original");
    await share(app, manager.accessToken, vocabulary.id);

    const duplicated = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}/duplicate`,
      { method: "POST", accessToken: manager.accessToken, body: { name: "Copy" } },
    );
    expect(duplicated.status).toBe(201);

    const onCopy = await apiJson<{ shareLink: ShareLink | null }>(
      app,
      `/vocabularies/${duplicated.body.vocabulary.id}/share-link`,
      { accessToken: manager.accessToken },
    );

    expect(onCopy.status).toBe(200);
    expect(onCopy.body.shareLink).toBeNull();
  });
});
