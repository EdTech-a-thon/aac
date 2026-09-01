import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.js";

type Vocabulary = { id: string; name: string; displayName: string };
type ShareLink = { id: string; token: string; board_id: string | null };

type SharedPayload = {
  share: {
    kind: string;
    vocabulary: { id: string };
    board: { id: string; displayName: string } | null;
  };
  content: {
    boards: { id: string; kind: string }[];
    buttonsByBoardId: Record<string, { id: string; action: unknown }[]>;
    paletteColors: { id: string }[];
    snippetInclusions: { id: string }[];
  };
};

async function createVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  name = "Board share",
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

function shareBoard(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  vocabularyId: string,
  boardId: string,
) {
  return apiJson<{ shareLink: ShareLink }>(
    app,
    `/vocabularies/${vocabularyId}/boards/${boardId}/share-link`,
    { method: "POST", accessToken },
  );
}

function readShared(app: ReturnType<typeof testApp>, token: string) {
  return apiJson<SharedPayload & { error?: string }>(app, `/shared/${token}`);
}

describe("Share Link for a Board", () => {
  it("shows the Board with the Snippets it needs, and nothing else in the Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    const otherId = randomUUID();
    const snippetId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: otherId, name: "Private", width: 4, height: 3 },
      { op: "create_board", id: snippetId, name: "Strip", width: 2, height: 1, kind: "snippet" },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 0,
        origin_col: 1,
      },
      { op: "create_button", id: randomUUID(), board_id: homeId, row_index: 0, col_index: 0, label: "here" },
      { op: "create_button", id: randomUUID(), board_id: otherId, row_index: 0, col_index: 0, label: "hidden" },
    ]);

    const minted = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);
    expect(minted.status).toBe(201);
    const opened = await readShared(app, minted.body.shareLink.token);

    expect(opened.status).toBe(200);
    expect(opened.body.share.kind).toBe("board");
    expect(opened.body.share.board?.displayName).toBe("Home");
    expect(opened.body.content.boards.map((board) => board.id).sort()).toEqual(
      [homeId, snippetId].sort(),
    );
    expect(JSON.stringify(opened.body)).not.toContain(otherId);
    expect(JSON.stringify(opened.body)).not.toContain("hidden");
  });

  it("clears an Open Board Action pointing outside the share without naming its target", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    const secretId = randomUUID();
    const selfButton = randomUUID();
    const awayButton = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: secretId, name: "Secret", width: 4, height: 3 },
      {
        op: "create_button",
        id: selfButton,
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "stay",
        action: { kind: "open_board", board_id: homeId },
      },
      {
        op: "create_button",
        id: awayButton,
        board_id: homeId,
        row_index: 0,
        col_index: 1,
        label: "go",
        action: { kind: "open_board", board_id: secretId },
      },
    ]);

    const minted = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);
    const opened = await readShared(app, minted.body.shareLink.token);

    const buttons = opened.body.content.buttonsByBoardId[homeId];
    expect(buttons.find((button) => button.id === selfButton)?.action).toEqual({
      kind: "open_board",
      board_id: homeId,
    });
    expect(buttons.find((button) => button.id === awayButton)?.action).toBeNull();
    expect(JSON.stringify(opened.body)).not.toContain(secretId);
    expect(JSON.stringify(opened.body)).not.toContain("Secret");
  });

  it("carries only the Palette Colors the shared Board's Buttons are bound to", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const palette = await apiJson<{ paletteColors: { id: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    const bound = palette.body.paletteColors[0].id;
    const homeId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "one",
        palette_color_id: bound,
      },
    ]);

    const minted = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);
    const opened = await readShared(app, minted.body.shareLink.token);

    expect(opened.body.content.paletteColors.map((color) => color.id)).toEqual([bound]);
    expect(opened.body.content.paletteColors.length).toBeLessThan(
      palette.body.paletteColors.length,
    );
  });

  it("keeps one live Share Link per Board, and revokes it permanently", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
    ]);

    const first = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);
    const again = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);
    expect(again.body.shareLink.token).toBe(first.body.shareLink.token);

    const revoked = await apiJson(
      app,
      `/vocabularies/${vocabulary.id}/boards/${homeId}/share-link`,
      { method: "DELETE", accessToken: manager.accessToken },
    );
    expect(revoked.status).toBe(200);
    expect((await readShared(app, first.body.shareLink.token)).status).toBe(404);

    const second = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);
    expect(second.body.shareLink.token).not.toBe(first.body.shareLink.token);
  });

  it("is separate from the Vocabulary's own Share Link", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: randomUUID(), name: "Other", width: 4, height: 3 },
    ]);

    const wholeVocabulary = await apiJson<{ shareLink: ShareLink }>(
      app,
      `/vocabularies/${vocabulary.id}/share-link`,
      { method: "POST", accessToken: manager.accessToken },
    );
    const justTheBoard = await shareBoard(app, manager.accessToken, vocabulary.id, homeId);

    expect(justTheBoard.body.shareLink.token).not.toBe(wholeVocabulary.body.shareLink.token);
    const asVocabulary = await readShared(app, wholeVocabulary.body.shareLink.token);
    const asBoard = await readShared(app, justTheBoard.body.shareLink.token);
    expect(asVocabulary.body.content.boards).toHaveLength(2);
    expect(asBoard.body.content.boards).toHaveLength(1);
  });

  it("refuses to share a Snippet", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const snippetId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: snippetId, name: "Strip", width: 2, height: 1, kind: "snippet" },
    ]);

    const minted = await shareBoard(app, manager.accessToken, vocabulary.id, snippetId);

    expect(minted.status).toBeGreaterThanOrEqual(400);
  });

  it("dies with its Board", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    const doomedId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: doomedId, name: "Doomed", width: 4, height: 3 },
    ]);
    const minted = await shareBoard(app, manager.accessToken, vocabulary.id, doomedId);
    expect((await readShared(app, minted.body.shareLink.token)).status).toBe(200);

    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "delete_board", id: doomedId },
    ]);

    expect((await readShared(app, minted.body.shareLink.token)).status).toBe(404);
  });

  it("refuses a Board in a Vocabulary the caller does not manage", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
    ]);

    const minted = await shareBoard(app, outsider.accessToken, vocabulary.id, homeId);

    expect(minted.status).toBeGreaterThanOrEqual(400);
  });
});
