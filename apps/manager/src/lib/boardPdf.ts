import { readingButtons } from './boardReading';
import { resolveButtonHex } from './buttonFace';
import { isSnippet, type Board, type BoardButton, type SnippetInclusion } from './types';

export type PdfBoard = {
	name: string;
	width: number;
	height: number;
	cells: { row: number; col: number; label: string; color: string; symbol: string | null }[];
};

/** Snapshot only the visible faces, never actions or editor metadata. */
export function pdfBoards(
	boards: Board[],
	buttonsByBoardId: Record<string, BoardButton[]>,
	inclusions: SnippetInclusion[],
	palette: Record<string, string>,
	boardId?: string
): PdfBoard[] {
	return boards.filter((board) => boardId ? board.id === boardId : !isSnippet(board)).map((board) => ({
		name: board.displayName,
		width: board.width,
		height: board.height,
		cells: [...readingButtons(board.id, boards, buttonsByBoardId, inclusions).values()].map((button) => ({
			row: button.row_index,
			col: button.col_index,
			label: button.label,
			color: resolveButtonHex(button, palette),
			symbol: button.symbol_digest
		}))
	}));
}

/** Letter-size pages at 200 dpi, with square cells and no cropping. */
export function pdfPageLayout(board: Pick<PdfBoard, 'width' | 'height'>) {
	if (!Number.isInteger(board.width) || !Number.isInteger(board.height) || board.width < 1 || board.height < 1) {
		throw new Error('Cannot export a board with invalid dimensions.');
	}
	const landscape = board.width > board.height;
	const width = landscape ? 2200 : 1700;
	const height = landscape ? 1700 : 2200;
	const margin = 80;
	const top = 160;
	const pitch = Math.min((width - margin * 2) / board.width, (height - top - margin) / board.height);
	return {
		width, height, landscape, pitch,
		gap: pitch * 0.07,
		left: (width - pitch * board.width) / 2,
		top: top + (height - top - margin - pitch * board.height) / 2
	};
}

export function pdfFilename(name: string): string {
	return `${name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().slice(0, 120) || 'Vocabulary'}.pdf`;
}
