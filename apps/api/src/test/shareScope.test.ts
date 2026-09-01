import { describe, expect, it } from "vitest";
import { scopeBoardShare } from "../shareScope.js";

type Grid = { id: string; kind: "board" | "snippet" };
type Btn = {
  id: string;
  board_id: string;
  palette_color_id: string | null;
  action: Record<string, unknown> | null;
};
type Inc = { id: string; host_id: string; snippet_id: string };
type Color = { id: string };

function grid(id: string, kind: "board" | "snippet" = "board"): Grid {
  return { id, kind };
}

function btn(id: string, boardId: string, extra: Partial<Btn> = {}): Btn {
  return { id, board_id: boardId, palette_color_id: null, action: null, ...extra };
}

function inc(id: string, hostId: string, snippetId: string): Inc {
  return { id, host_id: hostId, snippet_id: snippetId };
}

function scope(input: {
  boards: Grid[];
  buttons?: Btn[];
  snippetInclusions?: Inc[];
  paletteColors?: Color[];
  boardId: string;
}) {
  return scopeBoardShare({
    boards: input.boards,
    buttons: input.buttons ?? [],
    snippetInclusions: input.snippetInclusions ?? [],
    paletteColors: input.paletteColors ?? [],
    boardId: input.boardId,
  });
}

describe("what a Board Share Link exposes", () => {
  it("carries the shared Board and leaves the rest of the Vocabulary out", () => {
    const scoped = scope({
      boards: [grid("home"), grid("food"), grid("strip", "snippet")],
      boardId: "home",
    });

    expect(scoped?.boards.map((entry) => entry.id)).toEqual(["home"]);
  });

  it("carries the Snippets the Board needs to draw itself, through the whole chain", () => {
    const scoped = scope({
      boards: [grid("home"), grid("strip", "snippet"), grid("inner", "snippet"), grid("loose", "snippet")],
      snippetInclusions: [inc("i1", "home", "strip"), inc("i2", "strip", "inner")],
      boardId: "home",
    });

    expect(scoped?.boards.map((entry) => entry.id).sort()).toEqual(["home", "inner", "strip"]);
    expect(scoped?.snippetInclusions.map((entry) => entry.id).sort()).toEqual(["i1", "i2"]);
  });

  it("leaves out a Snippet included by some other Board", () => {
    const scoped = scope({
      boards: [grid("home"), grid("food"), grid("elsewhere", "snippet")],
      snippetInclusions: [inc("i1", "food", "elsewhere")],
      boardId: "home",
    });

    expect(scoped?.boards.map((entry) => entry.id)).toEqual(["home"]);
    expect(scoped?.snippetInclusions).toEqual([]);
  });

  it("carries the Buttons of everything in scope and no others", () => {
    const scoped = scope({
      boards: [grid("home"), grid("food"), grid("strip", "snippet")],
      snippetInclusions: [inc("i1", "home", "strip")],
      buttons: [btn("a", "home"), btn("b", "strip"), btn("c", "food")],
      boardId: "home",
    });

    expect(scoped?.buttons.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
  });

  it("carries only the Palette Colors the Buttons in scope are bound to", () => {
    const scoped = scope({
      boards: [grid("home"), grid("food")],
      buttons: [
        btn("a", "home", { palette_color_id: "noun" }),
        btn("b", "home", { palette_color_id: null }),
        btn("c", "food", { palette_color_id: "verb" }),
      ],
      paletteColors: [{ id: "noun" }, { id: "verb" }, { id: "unused" }],
      boardId: "home",
    });

    expect(scoped?.paletteColors.map((entry) => entry.id)).toEqual(["noun"]);
  });

  it("keeps an Open Board Action that targets the shared Board itself", () => {
    const scoped = scope({
      boards: [grid("home")],
      buttons: [btn("a", "home", { action: { kind: "open_board", board_id: "home" } })],
      boardId: "home",
    });

    expect(scoped?.buttons[0].action).toEqual({ kind: "open_board", board_id: "home" });
  });

  it("clears an Open Board Action pointing outside the share, leaving no trace of the target", () => {
    const scoped = scope({
      boards: [grid("home"), grid("secret")],
      buttons: [btn("a", "home", { action: { kind: "open_board", board_id: "secret" } })],
      boardId: "home",
    });

    expect(scoped?.buttons[0].action).toBeNull();
    expect(JSON.stringify(scoped)).not.toContain("secret");
  });

  it("leaves Actions that navigate nowhere untouched", () => {
    const scoped = scope({
      boards: [grid("home")],
      buttons: [
        btn("a", "home", { action: { kind: "insert_phrase", phrase: "more" } }),
        btn("b", "home", { action: { kind: "backspace" } }),
      ],
      boardId: "home",
    });

    expect(scoped?.buttons.map((entry) => entry.action)).toEqual([
      { kind: "insert_phrase", phrase: "more" },
      { kind: "backspace" },
    ]);
  });

  it("refuses to share a Snippet directly", () => {
    expect(scope({ boards: [grid("strip", "snippet")], boardId: "strip" })).toBeNull();
  });

  it("refuses an identifier that names nothing", () => {
    expect(scope({ boards: [grid("home")], boardId: "nope" })).toBeNull();
  });

  it("survives a Snippet Inclusion cycle without looping forever", () => {
    const scoped = scope({
      boards: [grid("home"), grid("a", "snippet"), grid("b", "snippet")],
      snippetInclusions: [inc("i1", "home", "a"), inc("i2", "a", "b"), inc("i3", "b", "a")],
      boardId: "home",
    });

    expect(scoped?.boards.map((entry) => entry.id).sort()).toEqual(["a", "b", "home"]);
  });
});
