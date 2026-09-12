import type { Board, BoardButton, SnippetInclusion } from './types';

/** Flatten each viewport before placing it in its parent; empty cells stay transparent. */
export function readingButtons(
	boardId: string,
	boards: Board[],
	buttonsByBoardId: Record<string, BoardButton[]>,
	inclusions: SnippetInclusion[],
	visiting = new Set<string>()
): Map<string, BoardButton> {
	const board = boards.find((candidate) => candidate.id === boardId);
	const cells = new Map<string, BoardButton>();
	if (!board || visiting.has(boardId)) return cells;
	const next = new Set(visiting).add(boardId);
	const oldestFirst = (a: { created_at: string; id: string }, b: { created_at: string; id: string }) =>
		a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
	const place = (button: BoardButton, row: number, col: number) => {
		if (row >= 0 && col >= 0 && row < board.height && col < board.width) {
			cells.set(`${row}:${col}`, { ...button, row_index: row, col_index: col });
		}
	};
	for (const inclusion of inclusions.filter((item) => item.host_id === boardId).sort(oldestFirst)) {
		for (const button of readingButtons(inclusion.snippet_id, boards, buttonsByBoardId, inclusions, next).values()) {
			place(button, button.row_index + inclusion.origin_row, button.col_index + inclusion.origin_col);
		}
	}
	for (const button of [...(buttonsByBoardId[boardId] ?? [])].sort(oldestFirst)) {
		place(button, button.row_index, button.col_index);
	}
	return cells;
}
