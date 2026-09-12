import { describe, expect, it } from 'vitest';
import { readingButtons } from './boardReading';
import type { Board, BoardButton, SnippetInclusion } from './types';

function board(partial: Partial<Board> & Pick<Board, 'id'>): Board {
	return {
		vocabulary_id: 'vocab-1',
		name: 'Home',
		displayName: 'Home',
		width: 2,
		height: 2,
		kind: 'board',
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		...partial
	};
}

function button(partial: Partial<BoardButton> & Pick<BoardButton, 'id'>): BoardButton {
	return {
		board_id: 'board-1',
		row_index: 0,
		col_index: 0,
		label: 'eat',
		background_color: null,
		palette_color_id: null,
		action: null,
		symbol_digest: null,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		...partial
	};
}

function inclusion(
	partial: Partial<SnippetInclusion> & Pick<SnippetInclusion, 'id' | 'host_id' | 'snippet_id'>
): SnippetInclusion {
	return {
		origin_row: 0,
		origin_col: 0,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		...partial
	};
}

describe('readingButtons', () => {
	it('places a Board’s own Buttons at their coordinates', () => {
		const cells = readingButtons(
			'board-1',
			[board({ id: 'board-1' })],
			{ 'board-1': [button({ id: 'a', row_index: 1, col_index: 1 })] },
			[]
		);

		expect(cells.get('1:1')?.id).toBe('a');
		expect(cells.get('0:0')).toBeUndefined();
	});

	it('leaves out Buttons outside the viewport', () => {
		const cells = readingButtons(
			'board-1',
			[board({ id: 'board-1', width: 2, height: 2 })],
			{ 'board-1': [button({ id: 'off', row_index: 5, col_index: 0 })] },
			[]
		);

		expect(cells.size).toBe(0);
	});

	it('gives an overlapping cell to the newest Button', () => {
		const cells = readingButtons(
			'board-1',
			[board({ id: 'board-1' })],
			{
				'board-1': [
					button({ id: 'newer', created_at: '2026-02-01T00:00:00.000Z' }),
					button({ id: 'older', created_at: '2026-01-01T00:00:00.000Z' })
				]
			},
			[]
		);

		expect(cells.get('0:0')?.id).toBe('newer');
	});

	it('maps an included Snippet’s Buttons to host coordinates', () => {
		const cells = readingButtons(
			'board-1',
			[
				board({ id: 'board-1', width: 3, height: 3 }),
				board({ id: 'snippet-1', kind: 'snippet', width: 1, height: 1 })
			],
			{ 'snippet-1': [button({ id: 'inner', board_id: 'snippet-1' })] },
			[inclusion({ id: 'inc-1', host_id: 'board-1', snippet_id: 'snippet-1', origin_row: 2, origin_col: 1 })]
		);

		expect(cells.get('2:1')?.id).toBe('inner');
	});

	it('lets a host Button beat inclusion content in the same cell', () => {
		const cells = readingButtons(
			'board-1',
			[board({ id: 'board-1' }), board({ id: 'snippet-1', kind: 'snippet', width: 1, height: 1 })],
			{
				'board-1': [button({ id: 'host', created_at: '2026-01-01T00:00:00.000Z' })],
				'snippet-1': [
					button({ id: 'inner', board_id: 'snippet-1', created_at: '2026-03-01T00:00:00.000Z' })
				]
			},
			[inclusion({ id: 'inc-1', host_id: 'board-1', snippet_id: 'snippet-1' })]
		);

		expect(cells.get('0:0')?.id).toBe('host');
	});

	it('gives an overlapped cell to the newest inclusion', () => {
		const cells = readingButtons(
			'board-1',
			[
				board({ id: 'board-1' }),
				board({ id: 'snippet-older', kind: 'snippet', width: 1, height: 1 }),
				board({ id: 'snippet-newer', kind: 'snippet', width: 1, height: 1 })
			],
			{
				'snippet-older': [button({ id: 'from-older', board_id: 'snippet-older' })],
				'snippet-newer': [button({ id: 'from-newer', board_id: 'snippet-newer' })]
			},
			[
				inclusion({
					id: 'inc-older',
					host_id: 'board-1',
					snippet_id: 'snippet-older',
					created_at: '2026-01-01T00:00:00.000Z'
				}),
				inclusion({
					id: 'inc-newer',
					host_id: 'board-1',
					snippet_id: 'snippet-newer',
					created_at: '2026-02-01T00:00:00.000Z'
				})
			]
		);

		expect(cells.get('0:0')?.id).toBe('from-newer');
	});

	it('flattens a Snippet included by another Snippet', () => {
		const cells = readingButtons(
			'board-1',
			[
				board({ id: 'board-1', width: 4, height: 4 }),
				board({ id: 'outer', kind: 'snippet', width: 2, height: 2 }),
				board({ id: 'inner', kind: 'snippet', width: 1, height: 1 })
			],
			{ inner: [button({ id: 'deep', board_id: 'inner' })] },
			[
				inclusion({ id: 'inc-1', host_id: 'board-1', snippet_id: 'outer', origin_row: 1, origin_col: 1 }),
				inclusion({ id: 'inc-2', host_id: 'outer', snippet_id: 'inner', origin_row: 1, origin_col: 0 })
			]
		);

		expect(cells.get('2:1')?.id).toBe('deep');
	});

	it('stops rather than recursing forever on a cyclic inclusion', () => {
		const cells = readingButtons(
			'board-1',
			[
				board({ id: 'board-1' }),
				board({ id: 'snippet-a', kind: 'snippet', width: 1, height: 1 }),
				board({ id: 'snippet-b', kind: 'snippet', width: 1, height: 1 })
			],
			{ 'snippet-a': [button({ id: 'from-a', board_id: 'snippet-a' })] },
			[
				inclusion({ id: 'inc-1', host_id: 'board-1', snippet_id: 'snippet-a' }),
				inclusion({ id: 'inc-2', host_id: 'snippet-a', snippet_id: 'snippet-b' }),
				inclusion({ id: 'inc-3', host_id: 'snippet-b', snippet_id: 'snippet-a' })
			]
		);

		expect(cells.get('0:0')?.id).toBe('from-a');
	});
});
