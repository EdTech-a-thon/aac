import { describe, expect, it } from 'vitest';
import { groupSuggestedChanges, type RichLookupContext } from './groupSuggestedChanges';

const ctx: RichLookupContext = {
	boards: [
		{ id: 'board-1', name: 'Home', width: 3, height: 3 },
		{ id: 'board-2', name: 'Food', width: 2, height: 2 }
	],
	buttons: [
		{
			id: 'btn-1',
			board_id: 'board-1',
			label: 'eat',
			row_index: 0,
			col_index: 0,
			background_color: null,
			palette_color_id: null
		},
		{
			id: 'btn-2',
			board_id: 'board-1',
			label: 'go',
			row_index: 1,
			col_index: 1,
			background_color: '#ff0000',
			palette_color_id: null
		}
	],
	paletteColors: [{ id: 'color-1', name: 'Nouns', hex: '#aabbcc' }]
};

describe('groupSuggestedChanges', () => {
	it('keeps create/delete board as top-level groups and nests button changes by board', () => {
		const groups = groupSuggestedChanges(
			[
				{ op: 'create_board', id: 'board-new', name: 'Places', width: 2, height: 2 },
				{
					op: 'create_button',
					id: 'btn-new',
					board_id: 'board-new',
					row_index: 0,
					col_index: 1,
					label: 'park'
				},
				{ op: 'delete_board', id: 'board-2' },
				{ op: 'update_button', id: 'btn-1', row_index: 0, col_index: 2 },
				{ op: 'delete_button', id: 'btn-2' },
				{
					op: 'create_palette_color',
					id: 'c-new',
					hex: '#0000ff',
					name: 'Verbs',
					description: '',
					position: 1
				}
			],
			ctx
		);

		expect(groups.map((g) => g.kind)).toEqual([
			'create_board',
			'delete_board',
			'board',
			'palette'
		]);

		const created = groups[0];
		expect(created.kind).toBe('create_board');
		if (created.kind === 'create_board') {
			expect(created.summary).toContain('Places');
			expect(created.overlays).toEqual([
				{ kind: 'create', row: 0, col: 1, label: 'park' }
			]);
			expect(created.changeLines[0]).toContain('park');
		}

		const deleted = groups[1];
		expect(deleted.kind).toBe('delete_board');

		const board = groups[2];
		expect(board.kind).toBe('board');
		if (board.kind === 'board') {
			expect(board.name).toBe('Home');
			expect(board.overlays).toEqual(
				expect.arrayContaining([
					{ kind: 'move', fromRow: 0, fromCol: 0, toRow: 0, toCol: 2 },
					{ kind: 'delete', row: 1, col: 1 }
				])
			);
			expect(board.changeLines.some((line) => line.includes('move to C1'))).toBe(true);
			expect(board.changeLines.some((line) => line.includes("Delete 'go' button"))).toBe(
				true
			);
		}

		const palette = groups[3];
		expect(palette.kind).toBe('palette');
		if (palette.kind === 'palette') {
			expect(palette.changeLines[0]).toContain('Verbs');
		}
	});
});
