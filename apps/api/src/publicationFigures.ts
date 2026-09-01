import type { FullVocabularySnapshot } from "./vocabularySnapshot.js";

/**
 * What a Gallery listing shows about a Vocabulary's size, so someone can judge
 * it without opening it. Derived once at publish and stored on the Publication
 * Version, because a frozen version must not be described by live tables.
 */
export type PublicationFigures = {
  board_count: number;
  button_count: number;
  min_columns: number;
  min_rows: number;
  max_columns: number;
  max_rows: number;
};

/**
 * Snippets are grids but they are not Boards, so they are left out of the board
 * count and out of the grid size range. Every Button counts, including those on
 * Snippets — they are all part of what a copier gets, and Button count is the
 * honest complexity signal where a grid size is only capacity.
 *
 * The range runs over each dimension independently. Ranging over total cells
 * instead would let one Board stand for the whole spread, so a Vocabulary of a
 * 2×12 and a 6×4 — equal in cells — would advertise a single size and hide the
 * other shape entirely.
 */
export function publicationFigures(snapshot: FullVocabularySnapshot): PublicationFigures {
  const boards = snapshot.boards.filter((grid) => grid.kind !== "snippet");

  let minColumns = 0;
  let minRows = 0;
  let maxColumns = 0;
  let maxRows = 0;

  if (boards.length > 0) {
    const widths = boards.map((board) => board.width);
    const heights = boards.map((board) => board.height);
    minColumns = Math.min(...widths);
    maxColumns = Math.max(...widths);
    minRows = Math.min(...heights);
    maxRows = Math.max(...heights);
  }

  return {
    board_count: boards.length,
    button_count: snapshot.buttons.length,
    min_columns: minColumns,
    min_rows: minRows,
    max_columns: maxColumns,
    max_rows: maxRows,
  };
}

/** The distinct Symbols a Vocabulary uses, for the contact sheet shown before publishing. */
export function snapshotSymbolDigests(snapshot: FullVocabularySnapshot): string[] {
  const digests = new Set<string>();
  for (const button of snapshot.buttons) {
    if (button.symbol_digest) digests.add(button.symbol_digest);
  }
  return [...digests].sort();
}
