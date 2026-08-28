/**
 * Vocabulary duplication and Board Copy.
 *
 * Requires the creation-order and copy migrations to be applied.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string; name: string; displayName: string };
type Board = {
  id: string;
  name: string;
  kind: "board" | "snippet";
  width: number;
  height: number;
  created_at: string;
};
type Button = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string | null;
  palette_color_id: string | null;
  symbol_digest: string | null;
  action: { kind: string; board_id?: string; phrase?: string } | null;
};
type PaletteColor = { id: string; hex: string; name: string; position: number };
type SnippetInclusion = {
  id: string;
  host_id: string;
  snippet_id: string;
  origin_row: number;
  origin_col: number;
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

async function apply(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  vocabularyId: string,
  mutations: Record<string, unknown>[],
) {
  const submitted = await apiJson(app, `/vocabularies/${vocabularyId}/change-sets`, {
    accessToken,
    body: { status: "applied", mutations },
  });
  expect(submitted.status).toBe(201);
}

const listBoards = (app: ReturnType<typeof testApp>, token: string, id: string) =>
  apiJson<{ boards: Board[] }>(app, `/vocabularies/${id}/boards`, { accessToken: token });

const listButtons = (
  app: ReturnType<typeof testApp>,
  token: string,
  id: string,
  boardId: string,
) =>
  apiJson<{ buttons: Button[] }>(app, `/vocabularies/${id}/boards/${boardId}/buttons`, {
    accessToken: token,
  });

const listPalette = (app: ReturnType<typeof testApp>, token: string, id: string) =>
  apiJson<{ paletteColors: PaletteColor[] }>(app, `/vocabularies/${id}/palette-colors`, {
    accessToken: token,
  });

const listInclusions = (app: ReturnType<typeof testApp>, token: string, id: string) =>
  apiJson<{ snippetInclusions: SnippetInclusion[] }>(
    app,
    `/vocabularies/${id}/snippet-inclusions`,
    { accessToken: token },
  );

const duplicate = (
  app: ReturnType<typeof testApp>,
  token: string,
  id: string,
  body: Record<string, unknown> = {},
) =>
  apiJson<{ vocabulary: Vocabulary; error?: string }>(
    app,
    `/vocabularies/${id}/duplicate`,
    { accessToken: token, body },
  );


const copyBoard = (
  app: ReturnType<typeof testApp>,
  token: string,
  sourceId: string,
  boardId: string,
  body: Record<string, unknown>,
) =>
  apiJson<{ boardId: string; warnings: { button_id: string }[]; error?: string }>(
    app,
    `/vocabularies/${sourceId}/boards/${boardId}/copy`,
    { accessToken: token, body },
  );

const listWarnings = (app: ReturnType<typeof testApp>, token: string, id: string) =>
  apiJson<{
    unresolvedCopyActions: { button_id: string; previous_board_name: string }[];
    error?: string;
  }>(app, `/vocabularies/${id}/unresolved-copy-actions`, { accessToken: token });

describe("Vocabulary duplication", () => {
  it("creates an independent Vocabulary from the source live state with fresh access", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Everyday");
    const homeId = randomUUID();
    const foodId = randomUUID();

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: foodId, name: "Food", width: 2, height: 2 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "Food",
        action: { kind: "open_board", board_id: foodId },
      },
    ]);
    await apiJson(app, `/vocabularies/${source.id}/communicators`, {
      accessToken: manager.accessToken,
      body: { email: communicator.email },
    });

    const duplicated = await duplicate(app, manager.accessToken, source.id, {
      name: "Everyday copy",
    });
    expect(duplicated.status).toBe(201);
    expect(duplicated.body.vocabulary.name).toBe("Everyday copy");
    expect(duplicated.body.vocabulary.id).not.toBe(source.id);
    const copyId = duplicated.body.vocabulary.id;

    const boards = await listBoards(app, manager.accessToken, copyId);
    expect(boards.body.boards.map((board) => board.name)).toEqual(["Home", "Food"]);
    const sourceBoardIds = new Set<string>([homeId, foodId]);
    expect(boards.body.boards.every((board) => !sourceBoardIds.has(board.id))).toBe(true);

    // The Home Board of the copy is the copy of the source's Home Board.
    expect(boards.body.boards[0].name).toBe("Home");

    const copiedHome = boards.body.boards[0];
    const copiedFood = boards.body.boards[1];
    const buttons = await listButtons(app, manager.accessToken, copyId, copiedHome.id);
    expect(buttons.body.buttons).toMatchObject([
      { label: "Food", action: { kind: "open_board", board_id: copiedFood.id } },
    ]);

    const history = await apiJson<{ changeSets: unknown[] }>(
      app,
      `/vocabularies/${copyId}/change-sets`,
      { accessToken: manager.accessToken },
    );
    expect(history.body.changeSets).toEqual([]);

    const communicators = await apiJson<{ communicators: unknown[] }>(
      app,
      `/vocabularies/${copyId}/communicators`,
      { accessToken: manager.accessToken },
    );
    expect(communicators.body.communicators).toEqual([]);

    const managers = await apiJson<{ managers: { id: string }[] }>(
      app,
      `/vocabularies/${copyId}/managers`,
      { accessToken: manager.accessToken },
    );
    expect(managers.body.managers.map((m) => m.id)).toEqual([manager.userId]);
  });

  it("copies the Palette and retargets bindings, custom hexes and unset backgrounds", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Colours");
    const boardId = randomUUID();
    const palette = await listPalette(app, manager.accessToken, source.id);
    const nouns = palette.body.paletteColors[0];

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: boardId, name: "Home", width: 4, height: 3 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 0,
        label: "bound",
        palette_color_id: nouns.id,
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 1,
        label: "custom",
        background_color: "#123456",
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 2,
        label: "unset",
      },
    ]);

    const copyId = (await duplicate(app, manager.accessToken, source.id, { name: "Colours copy" }))
      .body.vocabulary.id;
    const copiedPalette = await listPalette(app, manager.accessToken, copyId);
    expect(copiedPalette.body.paletteColors.map((c) => [c.name, c.hex, c.position])).toEqual(
      palette.body.paletteColors.map((c) => [c.name, c.hex, c.position]),
    );
    const sourceColorIds = new Set(palette.body.paletteColors.map((c) => c.id));
    expect(copiedPalette.body.paletteColors.every((c) => !sourceColorIds.has(c.id))).toBe(true);

    const copiedBoard = (await listBoards(app, manager.accessToken, copyId)).body.boards[0];
    const buttons = await listButtons(app, manager.accessToken, copyId, copiedBoard.id);
    const byLabel = Object.fromEntries(buttons.body.buttons.map((b) => [b.label, b]));
    // The binding follows the copied Palette Color, not the source's.
    expect(byLabel.bound.palette_color_id).toBe(copiedPalette.body.paletteColors[0].id);
    expect(byLabel.bound.palette_color_id).not.toBe(nouns.id);
    expect(byLabel.custom.palette_color_id).toBeNull();
    expect(byLabel.custom.background_color).toBe("#123456");
    expect(byLabel.unset.palette_color_id).toBeNull();
    expect(byLabel.unset.background_color).toBeNull();
  });

  it("copies Snippets and their Snippet Inclusions into the duplicate", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Snippets");
    const hostId = randomUUID();
    const snippetId = randomUUID();
    const nestedId = randomUUID();

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: hostId, name: "Home", width: 6, height: 4 },
      { op: "create_board", id: snippetId, name: "Strip", width: 3, height: 1, kind: "snippet" },
      { op: "create_board", id: nestedId, name: "Nested", width: 1, height: 1, kind: "snippet" },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: snippetId,
        snippet_id: nestedId,
        origin_row: 0,
        origin_col: 2,
      },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: hostId,
        snippet_id: snippetId,
        origin_row: 1,
        origin_col: 1,
      },
    ]);

    const copyId = (await duplicate(app, manager.accessToken, source.id, { name: "Snippets copy" }))
      .body.vocabulary.id;
    const boards = await listBoards(app, manager.accessToken, copyId);
    const copied = Object.fromEntries(boards.body.boards.map((b) => [b.name, b]));
    expect(copied.Strip.kind).toBe("snippet");
    expect(copied.Nested.kind).toBe("snippet");
    expect(copied.Home.kind).toBe("board");

    const inclusions = await listInclusions(app, manager.accessToken, copyId);
    const copiedBoardIds = new Set(boards.body.boards.map((b) => b.id));
    // Every inclusion resolves entirely inside the copy — nothing points home.
    expect(inclusions.body.snippetInclusions).toHaveLength(2);
    for (const inclusion of inclusions.body.snippetInclusions) {
      expect(copiedBoardIds.has(inclusion.host_id)).toBe(true);
      expect(copiedBoardIds.has(inclusion.snippet_id)).toBe(true);
    }
    expect(inclusions.body.snippetInclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          host_id: copied.Strip.id,
          snippet_id: copied.Nested.id,
          origin_col: 2,
        }),
        expect.objectContaining({
          host_id: copied.Home.id,
          snippet_id: copied.Strip.id,
          origin_row: 1,
          origin_col: 1,
        }),
      ]),
    );
  });

  it("preserves Buttons outside the viewport and their overlap order", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Overlap");
    const boardId = randomUUID();

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
      ...["under", "over"].map((label) => ({
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 0,
        label,
      })),
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 9,
        col_index: 9,
        label: "offscreen",
      },
    ]);

    const copyId = (await duplicate(app, manager.accessToken, source.id, { name: "Overlap copy" }))
      .body.vocabulary.id;
    const copiedBoard = (await listBoards(app, manager.accessToken, copyId)).body.boards[0];
    expect(copiedBoard.width).toBe(2);
    expect(copiedBoard.height).toBe(2);

    const buttons = await listButtons(app, manager.accessToken, copyId, copiedBoard.id);
    expect(buttons.body.buttons.map((b) => b.label)).toEqual(["under", "over", "offscreen"]);
    const offscreen = buttons.body.buttons[2];
    expect([offscreen.row_index, offscreen.col_index]).toEqual([9, 9]);
  });

  it("carries a Button's Symbol by reference", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Symbols");
    const boardId = randomUUID();
    const digest = "a".repeat(64);

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 0,
        label: "drink",
        symbol_digest: digest,
      },
    ]);

    const copyId = (await duplicate(app, manager.accessToken, source.id, { name: "Symbols copy" }))
      .body.vocabulary.id;
    const copiedBoard = (await listBoards(app, manager.accessToken, copyId)).body.boards[0];
    const buttons = await listButtons(app, manager.accessToken, copyId, copiedBoard.id);
    expect(buttons.body.buttons[0].symbol_digest).toBe(digest);
  });

  it("leaves the source Vocabulary untouched", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Source");
    const boardId = randomUUID();
    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: boardId, name: "Home", width: 3, height: 3 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 0,
        label: "hello",
      },
    ]);
    const before = await listBoards(app, manager.accessToken, source.id);
    const historyBefore = await apiJson<{ changeSets: unknown[] }>(
      app,
      `/vocabularies/${source.id}/change-sets`,
      { accessToken: manager.accessToken },
    );

    await duplicate(app, manager.accessToken, source.id, { name: "Source copy" });

    const after = await listBoards(app, manager.accessToken, source.id);
    expect(after.body.boards).toEqual(before.body.boards);
    const historyAfter = await apiJson<{ changeSets: unknown[] }>(
      app,
      `/vocabularies/${source.id}/change-sets`,
      { accessToken: manager.accessToken },
    );
    expect(historyAfter.body.changeSets).toHaveLength(historyBefore.body.changeSets.length);
  });

  it("refuses to duplicate a Vocabulary the User does not manage", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Private");

    const attempt = await duplicate(app, outsider.accessToken, source.id, { name: "Stolen" });
    expect(attempt.status).toBe(404);
  });

  it("duplicates an empty Vocabulary with its Palette", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Blank");

    const duplicated = await duplicate(app, manager.accessToken, source.id, { name: "Blank copy" });
    expect(duplicated.status).toBe(201);
    const copyId = duplicated.body.vocabulary.id;

    expect((await listBoards(app, manager.accessToken, copyId)).body.boards).toEqual([]);
    const palette = await listPalette(app, manager.accessToken, copyId);
    expect(palette.body.paletteColors).toHaveLength(10);
  });

  it("duplicates the visible state, including staged edits, leaving the source unapplied", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Staged");
    const liveBoardId = randomUUID();
    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: liveBoardId, name: "Home", width: 3, height: 3 },
    ]);
    const palette = await listPalette(app, manager.accessToken, source.id);

    // What the editor would send: the live Board renamed, plus a Board and a
    // Button that exist only as staged edits.
    const stagedBoardId = randomUUID();
    const snapshot = {
      boards: [
        {
          id: liveBoardId,
          name: "Renamed",
          width: 3,
          height: 3,
          kind: "board",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: stagedBoardId,
          name: "Staged",
          width: 2,
          height: 2,
          kind: "board",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      buttons: [
        {
          id: randomUUID(),
          board_id: stagedBoardId,
          row_index: 0,
          col_index: 0,
          label: "only staged",
          background_color: null,
          palette_color_id: null,
          action: null,
          symbol_digest: null,
          created_at: "2026-01-02T00:00:01.000Z",
        },
      ],
      palette_colors: palette.body.paletteColors,
      snippet_inclusions: [],
    };

    const duplicated = await duplicate(app, manager.accessToken, source.id, {
      name: "Staged copy",
      snapshot,
    });
    expect(duplicated.status).toBe(201);
    const copyId = duplicated.body.vocabulary.id;

    const copiedBoards = await listBoards(app, manager.accessToken, copyId);
    expect(copiedBoards.body.boards.map((board) => board.name)).toEqual(["Renamed", "Staged"]);
    const copiedStaged = copiedBoards.body.boards[1];
    const copiedButtons = await listButtons(app, manager.accessToken, copyId, copiedStaged.id);
    expect(copiedButtons.body.buttons.map((button) => button.label)).toEqual(["only staged"]);

    // The source keeps its live state and gains no history from the duplication.
    const sourceBoards = await listBoards(app, manager.accessToken, source.id);
    expect(sourceBoards.body.boards.map((board) => board.name)).toEqual(["Home"]);
    const sourceHistory = await apiJson<{ changeSets: unknown[] }>(
      app,
      `/vocabularies/${source.id}/change-sets`,
      { accessToken: manager.accessToken },
    );
    expect(sourceHistory.body.changeSets).toHaveLength(1);

    // The copy still starts with an empty history — staged edits arrive as its
    // Initial Snapshot, not as a Change Set.
    const copyHistory = await apiJson<{ changeSets: unknown[] }>(
      app,
      `/vocabularies/${copyId}/change-sets`,
      { accessToken: manager.accessToken },
    );
    expect(copyHistory.body.changeSets).toEqual([]);
  });
});
describe("Board Copy within one Vocabulary", () => {
  it("copies a Board immediately through one Applied Change Set", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "Within");
    const homeId = randomUUID();
    const foodId = randomUUID();
    const palette = await listPalette(app, manager.accessToken, vocabulary.id);
    const nouns = palette.body.paletteColors[0];

    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: foodId, name: "Food", width: 2, height: 2 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "to food",
        palette_color_id: nouns.id,
        action: { kind: "open_board", board_id: foodId },
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 1,
        label: "to self",
        action: { kind: "open_board", board_id: homeId },
      },
    ]);
    const historyBefore = await apiJson<{ changeSets: unknown[] }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      { accessToken: manager.accessToken },
    );

    const copied = await copyBoard(app, manager.accessToken, vocabulary.id, homeId, {
      name: "Home copy",
    });
    expect(copied.status).toBe(201);
    expect(copied.body.warnings).toEqual([]);

    const boards = await listBoards(app, manager.accessToken, vocabulary.id);
    expect(boards.body.boards.map((board) => board.name)).toEqual([
      "Home",
      "Food",
      "Home copy",
    ]);

    const buttons = await listButtons(app, manager.accessToken, vocabulary.id, copied.body.boardId);
    const byLabel = Object.fromEntries(buttons.body.buttons.map((b) => [b.label, b]));
    // Within one Vocabulary the Palette is the same one, so the binding is kept.
    expect(byLabel["to food"].palette_color_id).toBe(nouns.id);
    // An Action opening another Board still opens that same Board.
    expect(byLabel["to food"].action).toEqual({ kind: "open_board", board_id: foodId });
    // An Action that opened the source Board follows the copy.
    expect(byLabel["to self"].action).toEqual({
      kind: "open_board",
      board_id: copied.body.boardId,
    });

    const historyAfter = await apiJson<{ changeSets: { status: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      { accessToken: manager.accessToken },
    );
    expect(historyAfter.body.changeSets).toHaveLength(historyBefore.body.changeSets.length + 1);
    expect(historyAfter.body.changeSets.every((set) => set.status === "applied")).toBe(true);
  });

  it("includes the same live Snippets rather than duplicating them", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "Live snippets");
    const hostId = randomUUID();
    const snippetId = randomUUID();

    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: hostId, name: "Home", width: 6, height: 4 },
      { op: "create_board", id: snippetId, name: "Strip", width: 3, height: 1, kind: "snippet" },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: hostId,
        snippet_id: snippetId,
        origin_row: 2,
        origin_col: 1,
      },
    ]);

    const copied = await copyBoard(app, manager.accessToken, vocabulary.id, hostId, {
      name: "Home copy",
    });
    expect(copied.status).toBe(201);

    const boards = await listBoards(app, manager.accessToken, vocabulary.id);
    // No new Snippet: copying a Board must not fork the Snippets it shows.
    expect(boards.body.boards.filter((board) => board.kind === "snippet")).toHaveLength(1);

    const inclusions = await listInclusions(app, manager.accessToken, vocabulary.id);
    const onCopy = inclusions.body.snippetInclusions.filter(
      (inclusion) => inclusion.host_id === copied.body.boardId,
    );
    expect(onCopy).toHaveLength(1);
    expect(onCopy[0].snippet_id).toBe(snippetId);
    expect([onCopy[0].origin_row, onCopy[0].origin_col]).toEqual([2, 1]);
  });

  it("preserves off-viewport Buttons and overlap order on the copy", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "Copy overlap");
    const boardId = randomUUID();

    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
      ...["under", "over"].map((label) => ({
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 0,
        col_index: 0,
        label,
      })),
      {
        op: "create_button",
        id: randomUUID(),
        board_id: boardId,
        row_index: 7,
        col_index: 7,
        label: "offscreen",
      },
    ]);

    const copied = await copyBoard(app, manager.accessToken, vocabulary.id, boardId, {
      name: "Home copy",
    });
    const buttons = await listButtons(app, manager.accessToken, vocabulary.id, copied.body.boardId);
    expect(buttons.body.buttons.map((b) => b.label)).toEqual(["under", "over", "offscreen"]);
    expect([buttons.body.buttons[2].row_index, buttons.body.buttons[2].col_index]).toEqual([7, 7]);
  });

  it("refuses to copy a Board a User does not manage", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "Guarded");
    const boardId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
    ]);

    const attempt = await copyBoard(app, outsider.accessToken, vocabulary.id, boardId, {
      name: "Stolen",
    });
    expect(attempt.status).toBe(404);
  });
});

describe("Board Copy into another Vocabulary", () => {
  it("copies included Snippets, freezes Palette bindings, and remaps or clears Actions", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Source vocab");
    const destination = await createVocabulary(app, manager.accessToken, "Destination vocab");
    const homeId = randomUUID();
    const otherId = randomUUID();
    const snippetId = randomUUID();
    const nestedId = randomUUID();
    const palette = await listPalette(app, manager.accessToken, source.id);
    const nouns = palette.body.paletteColors[0];

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: homeId, name: "Home", width: 6, height: 4 },
      { op: "create_board", id: otherId, name: "Other", width: 2, height: 2 },
      { op: "create_board", id: snippetId, name: "Strip", width: 3, height: 1, kind: "snippet" },
      { op: "create_board", id: nestedId, name: "Nested", width: 1, height: 1, kind: "snippet" },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: snippetId,
        snippet_id: nestedId,
        origin_row: 0,
        origin_col: 2,
      },
      // The same Snippet twice on the host: it must be copied once.
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 0,
        origin_col: 0,
      },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 3,
        origin_col: 0,
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 4,
        label: "bound",
        palette_color_id: nouns.id,
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 1,
        col_index: 4,
        label: "to self",
        action: { kind: "open_board", board_id: homeId },
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 2,
        col_index: 4,
        label: "to other",
        action: { kind: "open_board", board_id: otherId },
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 3,
        col_index: 4,
        label: "says hello",
        action: { kind: "insert_phrase", phrase: "hello" },
      },
    ]);

    const copied = await copyBoard(app, manager.accessToken, source.id, homeId, {
      destinationVocabularyId: destination.id,
      name: "Home copy",
    });
    expect(copied.status).toBe(201);

    const destinationBoards = await listBoards(app, manager.accessToken, destination.id);
    const names = destinationBoards.body.boards.map((board) => board.name);
    expect(names).toContain("Home copy");
    // The included Snippet and the Snippet it includes both come along, once each.
    expect(names.filter((name) => name === "Strip")).toHaveLength(1);
    expect(names.filter((name) => name === "Nested")).toHaveLength(1);
    // The Board that was only an Action target is not dragged in.
    expect(names).not.toContain("Other");

    const copiedStrip = destinationBoards.body.boards.find((board) => board.name === "Strip")!;
    const inclusions = await listInclusions(app, manager.accessToken, destination.id);
    const onCopy = inclusions.body.snippetInclusions.filter(
      (inclusion) => inclusion.host_id === copied.body.boardId,
    );
    expect(onCopy).toHaveLength(2);
    expect(onCopy.every((inclusion) => inclusion.snippet_id === copiedStrip.id)).toBe(true);
    expect(copiedStrip.id).not.toBe(snippetId);

    const buttons = await listButtons(app, manager.accessToken, destination.id, copied.body.boardId);
    const byLabel = Object.fromEntries(buttons.body.buttons.map((b) => [b.label, b]));
    // The destination has its own Palette, so the binding freezes to the hex.
    expect(byLabel.bound.palette_color_id).toBeNull();
    expect(byLabel.bound.background_color).toBe(nouns.hex);
    expect(byLabel["to self"].action).toEqual({
      kind: "open_board",
      board_id: copied.body.boardId,
    });
    expect(byLabel["to other"].action).toBeNull();
    expect(byLabel["says hello"].action).toEqual({ kind: "insert_phrase", phrase: "hello" });

    // The source Vocabulary is untouched.
    const sourceBoards = await listBoards(app, manager.accessToken, source.id);
    expect(sourceBoards.body.boards.map((board) => board.name)).toEqual([
      "Home",
      "Other",
      "Strip",
      "Nested",
    ]);
  });

  it("keeps copied Snippets independent of the source", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Indep source");
    const destination = await createVocabulary(app, manager.accessToken, "Indep destination");
    const homeId = randomUUID();
    const snippetId = randomUUID();
    const snippetButtonId = randomUUID();

    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 4 },
      { op: "create_board", id: snippetId, name: "Strip", width: 2, height: 1, kind: "snippet" },
      {
        op: "create_button",
        id: snippetButtonId,
        board_id: snippetId,
        row_index: 0,
        col_index: 0,
        label: "original",
      },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 0,
        origin_col: 0,
      },
    ]);

    const copied = await copyBoard(app, manager.accessToken, source.id, homeId, {
      destinationVocabularyId: destination.id,
      name: "Home copy",
    });
    expect(copied.status).toBe(201);
    const copiedStrip = (await listBoards(app, manager.accessToken, destination.id)).body.boards.find(
      (board) => board.name === "Strip",
    )!;

    // Editing the source Snippet must not reach the copy.
    await apply(app, manager.accessToken, source.id, [
      { op: "update_button", id: snippetButtonId, label: "changed" },
    ]);

    const copiedButtons = await listButtons(
      app,
      manager.accessToken,
      destination.id,
      copiedStrip.id,
    );
    expect(copiedButtons.body.buttons.map((b) => b.label)).toEqual(["original"]);
  });

  it("refuses to copy into a Vocabulary the User does not manage", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const other = await createTestUser();
    const source = await createVocabulary(app, manager.accessToken, "Mine");
    const foreign = await createVocabulary(app, other.accessToken, "Theirs");
    const boardId = randomUUID();
    await apply(app, manager.accessToken, source.id, [
      { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
    ]);

    const attempt = await copyBoard(app, manager.accessToken, source.id, boardId, {
      destinationVocabularyId: foreign.id,
      name: "Pushed",
    });
    expect(attempt.status).toBe(404);
  });
});

describe("Unresolved Copy Actions", () => {
  async function copyWithClearedAction(app: ReturnType<typeof testApp>, accessToken: string) {
    const source = await createVocabulary(app, accessToken, "Warn source");
    const destination = await createVocabulary(app, accessToken, "Warn destination");
    const homeId = randomUUID();
    const otherId = randomUUID();
    await apply(app, accessToken, source.id, [
      { op: "create_board", id: homeId, name: "Home", width: 3, height: 3 },
      { op: "create_board", id: otherId, name: "", width: 2, height: 2 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "broken",
        action: { kind: "open_board", board_id: otherId },
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 1,
        label: "fine",
        action: { kind: "backspace" },
      },
    ]);
    const copied = await copyBoard(app, accessToken, source.id, homeId, {
      destinationVocabularyId: destination.id,
      name: "Home copy",
    });
    expect(copied.status).toBe(201);
    return { source, destination, copied };
  }

  it("warns about every Button whose Action was cleared, and only those", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const { destination, copied } = await copyWithClearedAction(app, manager.accessToken);

    const buttons = await listButtons(app, manager.accessToken, destination.id, copied.body.boardId);
    const byLabel = Object.fromEntries(buttons.body.buttons.map((b) => [b.label, b]));
    const warnings = await listWarnings(app, manager.accessToken, destination.id);

    expect(warnings.body.unresolvedCopyActions).toHaveLength(1);
    expect(warnings.body.unresolvedCopyActions[0].button_id).toBe(byLabel.broken.id);
    // The name of the Board that could not be copied is what makes repair possible.
    expect(warnings.body.unresolvedCopyActions[0].previous_board_name).toBe("");
    expect(byLabel.broken.action).toBeNull();
    expect(byLabel.fine.action).toEqual({ kind: "backspace" });
  });

  it("clears a warning when the Button is given a valid Action", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const { destination, copied } = await copyWithClearedAction(app, manager.accessToken);
    const buttons = await listButtons(app, manager.accessToken, destination.id, copied.body.boardId);
    const broken = buttons.body.buttons.find((b) => b.label === "broken")!;

    // Editing something else must not clear it.
    await apply(app, manager.accessToken, destination.id, [
      { op: "update_button", id: broken.id, label: "still broken" },
    ]);
    expect((await listWarnings(app, manager.accessToken, destination.id)).body.unresolvedCopyActions)
      .toHaveLength(1);

    await apply(app, manager.accessToken, destination.id, [
      { op: "update_button", id: broken.id, action: { kind: "backspace" } },
    ]);
    expect((await listWarnings(app, manager.accessToken, destination.id)).body.unresolvedCopyActions)
      .toEqual([]);
  });

  it("clears a warning when the Button is deleted", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const { destination, copied } = await copyWithClearedAction(app, manager.accessToken);
    const buttons = await listButtons(app, manager.accessToken, destination.id, copied.body.boardId);
    const broken = buttons.body.buttons.find((b) => b.label === "broken")!;

    await apply(app, manager.accessToken, destination.id, [
      { op: "delete_button", id: broken.id },
    ]);
    expect((await listWarnings(app, manager.accessToken, destination.id)).body.unresolvedCopyActions)
      .toEqual([]);
  });

  it("produces no warning when copying within one Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createVocabulary(app, manager.accessToken, "No warnings");
    const homeId = randomUUID();
    const otherId = randomUUID();
    await apply(app, manager.accessToken, vocabulary.id, [
      { op: "create_board", id: homeId, name: "Home", width: 3, height: 3 },
      { op: "create_board", id: otherId, name: "Other", width: 2, height: 2 },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "to other",
        action: { kind: "open_board", board_id: otherId },
      },
    ]);

    const copied = await copyBoard(app, manager.accessToken, vocabulary.id, homeId, {
      name: "Home copy",
    });
    expect(copied.body.warnings).toEqual([]);
    expect((await listWarnings(app, manager.accessToken, vocabulary.id)).body.unresolvedCopyActions)
      .toEqual([]);
  });

  it("hides warnings from a Communicator of that Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const { destination } = await copyWithClearedAction(app, manager.accessToken);
    await apiJson(app, `/vocabularies/${destination.id}/communicators`, {
      accessToken: manager.accessToken,
      body: { email: communicator.email },
    });

    const asCommunicator = await listWarnings(app, communicator.accessToken, destination.id);
    expect(asCommunicator.status).toBe(404);
  });
});
