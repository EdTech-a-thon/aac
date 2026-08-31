import { describe, expect, it } from "vitest";
import {
  publicationFigures,
  snapshotSymbolDigests,
} from "./publicationFigures.ts";
import type { FullVocabularySnapshot } from "./vocabularySnapshot.ts";

const AT = "2026-01-01T00:00:00.000Z";

function grid(
  id: string,
  width: number,
  height: number,
  kind: "board" | "snippet" = "board",
) {
  return {
    id,
    vocabulary_id: "vocab",
    name: id,
    width,
    height,
    kind,
    created_at: AT,
    updated_at: AT,
  };
}

function button(id: string, boardId: string, symbolDigest: string | null = null) {
  return {
    id,
    board_id: boardId,
    row_index: 0,
    col_index: 0,
    label: id,
    background_color: null,
    palette_color_id: null,
    action: null,
    symbol_digest: symbolDigest,
    created_at: AT,
    updated_at: AT,
  };
}

function snapshot(partial: Partial<FullVocabularySnapshot>): FullVocabularySnapshot {
  return {
    boards: [],
    buttons: [],
    palette_colors: [],
    snippet_inclusions: [],
    ...partial,
  };
}

describe("publicationFigures", () => {
  it("counts Boards and every Button", () => {
    const figures = publicationFigures(
      snapshot({
        boards: [grid("home", 4, 3), grid("food", 4, 3)],
        buttons: [button("a", "home"), button("b", "home"), button("c", "food")],
      }),
    );
    expect(figures.board_count).toBe(2);
    expect(figures.button_count).toBe(3);
  });

  it("leaves Snippets out of the board count but keeps their Buttons", () => {
    const figures = publicationFigures(
      snapshot({
        boards: [grid("home", 4, 3), grid("strip", 4, 1, "snippet")],
        buttons: [button("a", "home"), button("b", "strip")],
      }),
    );
    expect(figures.board_count).toBe(1);
    expect(figures.button_count).toBe(2);
  });

  it("collapses the grid range when every Board is the same size", () => {
    const figures = publicationFigures(
      snapshot({ boards: [grid("home", 4, 3), grid("food", 4, 3)] }),
    );
    expect(figures.min_columns).toBe(4);
    expect(figures.min_rows).toBe(3);
    expect(figures.max_columns).toBe(4);
    expect(figures.max_rows).toBe(3);
  });

  it("reports the smallest and largest of each dimension", () => {
    const figures = publicationFigures(
      snapshot({
        boards: [grid("mid", 6, 4), grid("small", 2, 2), grid("big", 10, 8)],
      }),
    );
    expect([figures.min_columns, figures.min_rows]).toEqual([2, 2]);
    expect([figures.max_columns, figures.max_rows]).toEqual([10, 8]);
  });

  it("ranges each dimension independently, so no Board is hidden", () => {
    // 10x1 and 3x8 have neither dimension in common. Ranging over total cells
    // would pick one of them and advertise it as the only size.
    const figures = publicationFigures(
      snapshot({ boards: [grid("wide", 10, 1), grid("tall", 3, 8)] }),
    );
    expect([figures.min_columns, figures.max_columns]).toEqual([3, 10]);
    expect([figures.min_rows, figures.max_rows]).toEqual([1, 8]);
  });

  it("does not collapse two Boards of equal area but different shape", () => {
    // 2x12 and 6x4 are both 24 cells; a cell-count range would show one size.
    const figures = publicationFigures(
      snapshot({ boards: [grid("tall", 2, 12), grid("wide", 6, 4)] }),
    );
    expect([figures.min_columns, figures.max_columns]).toEqual([2, 6]);
    expect([figures.min_rows, figures.max_rows]).toEqual([4, 12]);
  });

  it("ignores Snippet sizes in the range", () => {
    const figures = publicationFigures(
      snapshot({
        boards: [grid("home", 4, 3), grid("huge-strip", 40, 40, "snippet")],
      }),
    );
    expect([figures.max_columns, figures.max_rows]).toEqual([4, 3]);
  });

  it("reports zeroes for a Vocabulary with no Boards", () => {
    const figures = publicationFigures(snapshot({}));
    expect(figures).toEqual({
      board_count: 0,
      button_count: 0,
      min_columns: 0,
      min_rows: 0,
      max_columns: 0,
      max_rows: 0,
    });
  });
});

describe("snapshotSymbolDigests", () => {
  it("lists each Symbol once, however many Buttons carry it", () => {
    const digests = snapshotSymbolDigests(
      snapshot({
        boards: [grid("home", 4, 3)],
        buttons: [
          button("a", "home", "bbb"),
          button("b", "home", "aaa"),
          button("c", "home", "bbb"),
          button("d", "home", null),
        ],
      }),
    );
    expect(digests).toEqual(["aaa", "bbb"]);
  });

  it("is empty when no Button carries a Symbol", () => {
    expect(
      snapshotSymbolDigests(
        snapshot({ boards: [grid("home", 4, 3)], buttons: [button("a", "home")] }),
      ),
    ).toEqual([]);
  });
});
