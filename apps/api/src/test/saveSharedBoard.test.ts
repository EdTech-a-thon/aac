import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.js";

type Vocabulary = { id: string; name: string; displayName: string };
type Board = { id: string; name: string; displayName: string; kind: string };
type Btn = { id: string; label: string; action: unknown; palette_color_id: string | null; background_color: string | null };

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

function readShared(app: ReturnType<typeof testApp>, token: string) {
  return apiJson<{
    content: {
      boards: Board[];
      buttonsByBoardId: Record<string, unknown[]>;
      paletteColors: { id: string }[];
      snippetInclusions: unknown[];
    };
  }>(app, `/shared/${token}`);
}

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

function saveBoard(
  app: ReturnType<typeof testApp>,
  token: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiJson<{
    vocabulary?: Vocabulary;
    vocabularyId?: string;
    boardId?: string;
    warnings?: { previous_board_name: string }[];
    error?: string;
  }>(app, `/shared/${token}/save-board`, { method: "POST", accessToken, body });
}

/** A shared Board with a bound colour, a self-Action and an off-share Action. */
async function sharedBoardFixture(app: ReturnType<typeof testApp>) {
  const owner = await createTestUser();
  const vocabulary = await createVocabulary(app, owner.accessToken, "Source");
  const palette = await apiJson<{ paletteColors: { id: string; hex: string }[] }>(
    app,
    `/vocabularies/${vocabulary.id}/palette-colors`,
    { accessToken: owner.accessToken },
  );
  const bound = palette.body.paletteColors[0];
  const homeId = randomUUID();
  const awayId = randomUUID();
  await apply(app, owner.accessToken, vocabulary.id, [
    { op: "create_board", id: homeId, name: "Shared", width: 4, height: 3 },
    { op: "create_board", id: awayId, name: "Elsewhere", width: 4, height: 3 },
    {
      op: "create_button",
      id: randomUUID(),
      board_id: homeId,
      row_index: 0,
      col_index: 0,
      label: "stay",
      palette_color_id: bound.id,
      action: { kind: "open_board", board_id: homeId },
    },
    {
      op: "create_button",
      id: randomUUID(),
      board_id: homeId,
      row_index: 0,
      col_index: 1,
      label: "away",
      action: { kind: "open_board", board_id: awayId },
    },
  ]);
  const minted = await apiJson<{ shareLink: { token: string } }>(
    app,
    `/vocabularies/${vocabulary.id}/boards/${homeId}/share-link`,
    { method: "POST", accessToken: owner.accessToken },
  );
  const seen = await readShared(app, minted.body.shareLink.token);
  return {
    owner,
    vocabulary,
    homeId,
    boundHex: bound.hex,
    token: minted.body.shareLink.token,
    snapshot: snapshotOf(seen.body.content),
  };
}

describe("Keeping a shared Board", () => {
  it("becomes a new Vocabulary whose Palette bindings still work", async () => {
    const app = testApp();
    const fixture = await sharedBoardFixture(app);
    const visitor = await createTestUser();

    const saved = await saveBoard(app, fixture.token, visitor.accessToken, {
      name: "My board",
      snapshot: fixture.snapshot,
    });

    expect(saved.status).toBe(201);
    const newId = saved.body.vocabulary!.id;
    const boards = await apiJson<{ boards: Board[] }>(app, `/vocabularies/${newId}/boards`, {
      accessToken: visitor.accessToken,
    });
    expect(boards.body.boards).toHaveLength(1);
    expect(boards.body.boards[0].displayName).toBe("My board");

    const buttons = await apiJson<{ buttons: Btn[] }>(
      app,
      `/vocabularies/${newId}/boards/${boards.body.boards[0].id}/buttons`,
      { accessToken: visitor.accessToken },
    );
    // Bindings intact: a real Palette Color, not a frozen hex.
    expect(buttons.body.buttons.some((button) => button.palette_color_id !== null)).toBe(true);
  });

  it("makes the saver its sole Manager, and the Board its Home Board", async () => {
    const app = testApp();
    const fixture = await sharedBoardFixture(app);
    const visitor = await createTestUser();

    const saved = await saveBoard(app, fixture.token, visitor.accessToken, {
      name: "Home of its own",
      snapshot: fixture.snapshot,
    });
    const newId = saved.body.vocabulary!.id;

    const managers = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${newId}/managers`,
      { accessToken: visitor.accessToken },
    );
    const boards = await apiJson<{ boards: Board[] }>(app, `/vocabularies/${newId}/boards`, {
      accessToken: visitor.accessToken,
    });

    expect(managers.body.managers.map((m) => m.userId)).toEqual([visitor.userId]);
    expect(boards.body.boards.filter((board) => board.kind === "board")).toHaveLength(1);
  });

  it("into a Vocabulary they already manage, freezes colours and clears stray Actions", async () => {
    const app = testApp();
    const fixture = await sharedBoardFixture(app);
    const visitor = await createTestUser();
    const mine = await createVocabulary(app, visitor.accessToken, "Mine");

    const saved = await saveBoard(app, fixture.token, visitor.accessToken, {
      destinationVocabularyId: mine.id,
      name: "Added",
      snapshot: fixture.snapshot,
    });

    expect(saved.status).toBe(201);
    const buttons = await apiJson<{ buttons: Btn[] }>(
      app,
      `/vocabularies/${mine.id}/boards/${saved.body.boardId}/buttons`,
      { accessToken: visitor.accessToken },
    );
    const stay = buttons.body.buttons.find((button) => button.label === "stay")!;
    const away = buttons.body.buttons.find((button) => button.label === "away")!;

    expect(stay.palette_color_id).toBeNull();
    expect(stay.background_color).toBe(fixture.boundHex);
    expect(stay.action).toMatchObject({ kind: "open_board", board_id: saved.body.boardId });
    expect(away.action).toBeNull();
  });

  it("raises an Unresolved Copy Action for every Action it had to clear", async () => {
    const app = testApp();
    const fixture = await sharedBoardFixture(app);
    const visitor = await createTestUser();
    const mine = await createVocabulary(app, visitor.accessToken, "Mine");

    await saveBoard(app, fixture.token, visitor.accessToken, {
      destinationVocabularyId: mine.id,
      name: "Added",
      snapshot: fixture.snapshot,
    });

    const warnings = await apiJson<{ unresolvedCopyActions: { button_id: string }[] }>(
      app,
      `/vocabularies/${mine.id}/unresolved-copy-actions`,
      { accessToken: visitor.accessToken },
    );

    expect(warnings.body.unresolvedCopyActions).toHaveLength(1);
  });

  it("refuses a destination the saver does not manage", async () => {
    const app = testApp();
    const fixture = await sharedBoardFixture(app);
    const visitor = await createTestUser();

    const saved = await saveBoard(app, fixture.token, visitor.accessToken, {
      destinationVocabularyId: fixture.vocabulary.id,
      name: "Sneaky",
      snapshot: fixture.snapshot,
    });

    expect(saved.status).toBeGreaterThanOrEqual(400);
  });

  it("leaves the source Vocabulary untouched either way", async () => {
    const app = testApp();
    const fixture = await sharedBoardFixture(app);
    const visitor = await createTestUser();
    const mine = await createVocabulary(app, visitor.accessToken, "Mine");

    await saveBoard(app, fixture.token, visitor.accessToken, {
      name: "One",
      snapshot: fixture.snapshot,
    });
    await saveBoard(app, fixture.token, visitor.accessToken, {
      destinationVocabularyId: mine.id,
      name: "Two",
      snapshot: fixture.snapshot,
    });

    const boards = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${fixture.vocabulary.id}/boards`,
      { accessToken: fixture.owner.accessToken },
    );
    const managers = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${fixture.vocabulary.id}/managers`,
      { accessToken: fixture.owner.accessToken },
    );

    expect(boards.body.boards).toHaveLength(2);
    expect(managers.body.managers.map((m) => m.userId)).toEqual([fixture.owner.userId]);
  });

  it("refuses to keep a Board through a Vocabulary Share Link", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const visitor = await createTestUser();
    const vocabulary = await createVocabulary(app, owner.accessToken);
    const minted = await apiJson<{ shareLink: { token: string } }>(
      app,
      `/vocabularies/${vocabulary.id}/share-link`,
      { method: "POST", accessToken: owner.accessToken },
    );

    const saved = await saveBoard(app, minted.body.shareLink.token, visitor.accessToken, {
      name: "Wrong link",
      snapshot: { boards: [], buttons: [], palette_colors: [], snippet_inclusions: [] },
    });

    expect(saved.status).toBe(404);
  });
});
