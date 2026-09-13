import { describe, expect, it } from 'vitest';
import { pdfBoards, pdfFilename, pdfPageLayout } from './boardPdf';
import type { Board, BoardButton, SnippetInclusion } from './types';

const board = (id: string, kind: 'board' | 'snippet' = 'board'): Board => ({
	id, kind, vocabulary_id: 'v', name: id, displayName: id, width: 3, height: 2,
	created_at: '', updated_at: ''
});
const button = (id: string, boardId: string, row = 0, col = 0): BoardButton => ({
	id, board_id: boardId, row_index: row, col_index: col, label: 'Hello',
	background_color: '#ffffff', palette_color_id: 'color', symbol_digest: 'picture',
	action: { kind: 'speak_immediately', phrase: 'Private speech details' }, created_at: '', updated_at: ''
});
const inclusion: SnippetInclusion = {
	id: 'i', host_id: 'one', snippet_id: 'snippet', origin_row: 1, origin_col: 1, created_at: '', updated_at: ''
};

describe('PDF board snapshots', () => {
	it('exports every board, but not standalone snippets, in vocabulary order', () => {
		const pages = pdfBoards([board('one'), board('snippet', 'snippet'), board('two')], {}, [], {});
		expect(pages.map((page) => page.name)).toEqual(['one', 'two']);
	});

	it('exports just the selected board or snippet', () => {
		const boards = [board('one'), board('snippet', 'snippet')];
		expect(pdfBoards(boards, {}, [], {}, 'snippet').map((page) => page.name)).toEqual(['snippet']);
		expect(pdfBoards(boards, {}, [], {}, 'missing')).toEqual([]);
	});

	it('flattens snippets, resolves palette colors, clips cells, and excludes actions', () => {
		const pages = pdfBoards([board('one'), board('snippet', 'snippet')], {
			snippet: [button('included', 'snippet'), button('outside', 'snippet', 1, 2)]
		}, [inclusion], { color: '#ff0000' });
		expect(pages[0].cells).toEqual([{ row: 1, col: 1, label: 'Hello', color: '#ff0000', symbol: 'picture' }]);
		expect(JSON.stringify(pages)).not.toContain('Private speech details');
	});

	it('takes a detached snapshot of current edits and preserves empty boards', () => {
		const current = button('b', 'one');
		const pages = pdfBoards([board('one'), board('empty')], { one: [current] }, [], {});
		current.label = 'Changed afterward';
		expect(pages[0].cells[0].label).toBe('Hello');
		expect(pages[1].cells).toEqual([]);
	});
});

describe('PDF page layout', () => {
	it.each([[6, 5], [2, 8], [1, 1], [100, 1], [1, 100], [50, 50]])('fits %i × %i completely on one page', (width, height) => {
		const layout = pdfPageLayout({ width, height });
		expect(layout.landscape).toBe(width > height);
		expect(layout.left).toBeGreaterThanOrEqual(79);
		expect(layout.top).toBeGreaterThanOrEqual(159);
		expect(layout.left + width * layout.pitch).toBeLessThanOrEqual(layout.width - 79);
		expect(layout.top + height * layout.pitch).toBeLessThanOrEqual(layout.height - 79);
	});
	it('rejects invalid dimensions', () => {
		expect(() => pdfPageLayout({ width: 0, height: 2 })).toThrow('invalid dimensions');
	});
	it('makes safe PDF filenames', () => {
		expect(pdfFilename('Class / Week 1')).toBe('Class - Week 1.pdf');
		expect(pdfFilename('  ')).toBe('Vocabulary.pdf');
	});
});
