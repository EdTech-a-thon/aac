import { describe, expect, it } from 'vitest';
import { projectVocabulary, type ProjectedVocabulary } from './projectVocabulary';
import type { Board, BoardButton, PaletteColor } from './types';

function live(partial: Partial<ProjectedVocabulary> = {}): ProjectedVocabulary {
	return {
		vocabularyId: 'vocab-1',
		boards: [],
		buttons: [],
		paletteColors: [],
		...partial
	};
}

function board(partial: Partial<Board> & Pick<Board, 'id'>): Board {
	return {
		vocabulary_id: 'vocab-1',
		name: 'Home',
		displayName: 'Home',
		width: 2,
		height: 2,
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
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		...partial
	};
}

function color(partial: Partial<PaletteColor> & Pick<PaletteColor, 'id'>): PaletteColor {
	return {
		vocabulary_id: 'vocab-1',
		hex: '#aabbcc',
		name: 'Nouns',
		description: 'people, places, things',
		position: 0,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		...partial
	};
}

describe('projectVocabulary', () => {
	it('returns the live Boards, Buttons, and Palette unchanged when there are no mutations', () => {
		const home = board({ id: 'board-1' });
		const eat = button({ id: 'btn-1' });
		const nouns = color({ id: 'color-1' });
		const input = live({ boards: [home], buttons: [eat], paletteColors: [nouns] });

		const projected = projectVocabulary(input, []);

		expect(projected).toEqual(input);
		expect(projected).not.toBe(input);
		expect(projected.boards).not.toBe(input.boards);
	});

	it('adds a Board from create_board', () => {
		const projected = projectVocabulary(live(), [
			{ op: 'create_board', id: 'board-2', name: 'Food', width: 3, height: 4 }
		]);

		expect(projected.boards).toEqual([
			expect.objectContaining({
				id: 'board-2',
				vocabulary_id: 'vocab-1',
				name: 'Food',
				displayName: 'Food',
				width: 3,
				height: 4
			})
		]);
	});

	it('updates a Board from update_board', () => {
		const projected = projectVocabulary(
			live({ boards: [board({ id: 'board-1', name: 'Home', displayName: 'Home' })] }),
			[{ op: 'update_board', id: 'board-1', name: 'Renamed', width: 5 }]
		);

		expect(projected.boards).toEqual([
			expect.objectContaining({
				id: 'board-1',
				name: 'Renamed',
				displayName: 'Renamed',
				width: 5,
				height: 2
			})
		]);
	});

	it('delete_board removes the Board and its Buttons and clears Open Board Actions that pointed at it', () => {
		const projected = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' }), board({ id: 'board-2', name: 'Food', displayName: 'Food' })],
				buttons: [
					button({
						id: 'btn-home',
						board_id: 'board-1',
						action: { kind: 'open_board', board_id: 'board-2' }
					}),
					button({ id: 'btn-food', board_id: 'board-2', label: 'apple' })
				]
			}),
			[{ op: 'delete_board', id: 'board-2' }]
		);

		expect(projected.boards.map((b) => b.id)).toEqual(['board-1']);
		expect(projected.buttons).toEqual([
			expect.objectContaining({
				id: 'btn-home',
				action: null
			})
		]);
	});

	it('adds a Button from create_button', () => {
		const projected = projectVocabulary(
			live({ boards: [board({ id: 'board-1' })] }),
			[
				{
					op: 'create_button',
					id: 'btn-2',
					board_id: 'board-1',
					row_index: 1,
					col_index: 1,
					label: 'go',
					action: { kind: 'insert_phrase', phrase: 'go' }
				}
			]
		);

		expect(projected.buttons).toEqual([
			expect.objectContaining({
				id: 'btn-2',
				board_id: 'board-1',
				row_index: 1,
				col_index: 1,
				label: 'go',
				background_color: null,
				palette_color_id: null,
				action: { kind: 'insert_phrase', phrase: 'go' }
			})
		]);
	});

	it('update_button color XOR: a Palette Color binding clears custom hex, and a custom hex clears the binding', () => {
		const nouns = color({ id: 'color-1' });
		const custom = button({
			id: 'btn-1',
			background_color: '#ff0000',
			palette_color_id: null
		});
		const bound = button({
			id: 'btn-2',
			label: 'go',
			row_index: 0,
			col_index: 1,
			background_color: null,
			palette_color_id: 'color-1'
		});

		const afterBind = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' })],
				buttons: [custom],
				paletteColors: [nouns]
			}),
			[{ op: 'update_button', id: 'btn-1', palette_color_id: 'color-1' }]
		);
		expect(afterBind.buttons[0]).toEqual(
			expect.objectContaining({
				id: 'btn-1',
				palette_color_id: 'color-1',
				background_color: null
			})
		);

		const afterCustom = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' })],
				buttons: [bound],
				paletteColors: [nouns]
			}),
			[{ op: 'update_button', id: 'btn-2', background_color: '#00ff00' }]
		);
		expect(afterCustom.buttons[0]).toEqual(
			expect.objectContaining({
				id: 'btn-2',
				palette_color_id: null,
				background_color: '#00ff00'
			})
		);
	});

	it('delete_palette_color freezes bound Buttons to that Palette Color’s last hex', () => {
		const projected = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' })],
				buttons: [
					button({ id: 'btn-1', palette_color_id: 'color-1', background_color: null }),
					button({ id: 'btn-2', label: 'go', background_color: '#ff0000' })
				],
				paletteColors: [color({ id: 'color-1', hex: '#aabbcc' })]
			}),
			[{ op: 'delete_palette_color', id: 'color-1' }]
		);

		expect(projected.paletteColors).toEqual([]);
		expect(projected.buttons).toEqual([
			expect.objectContaining({
				id: 'btn-1',
				palette_color_id: null,
				background_color: '#aabbcc'
			}),
			expect.objectContaining({
				id: 'btn-2',
				background_color: '#ff0000',
				palette_color_id: null
			})
		]);
	});

	it('skips mutations whose targets are missing and keeps projecting the rest', () => {
		const projected = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' })],
				buttons: [button({ id: 'btn-1' })]
			}),
			[
				{ op: 'update_board', id: 'missing-board', name: 'Nope' },
				{ op: 'update_button', id: 'missing-btn', label: 'Nope' },
				{
					op: 'create_button',
					id: 'orphan',
					board_id: 'missing-board',
					row_index: 0,
					col_index: 0,
					label: 'orphan'
				},
				{ op: 'delete_palette_color', id: 'missing-color' },
				{ op: 'create_board', id: 'board-2', name: 'Food', width: 2, height: 2 }
			]
		);

		expect(projected.boards.map((b) => b.id)).toEqual(['board-1', 'board-2']);
		expect(projected.buttons).toEqual([expect.objectContaining({ id: 'btn-1', label: 'eat' })]);
		expect(projected.buttons.some((b) => b.id === 'orphan')).toBe(false);
	});

	it('update_button moves a Button and updates label and Action', () => {
		const projected = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' }), board({ id: 'board-2', name: 'Food', displayName: 'Food' })],
				buttons: [button({ id: 'btn-1' })]
			}),
			[
				{
					op: 'update_button',
					id: 'btn-1',
					board_id: 'board-2',
					row_index: 1,
					col_index: 2,
					label: 'apple',
					action: { kind: 'speak_immediately', phrase: 'apple' }
				}
			]
		);

		expect(projected.buttons).toEqual([
			expect.objectContaining({
				id: 'btn-1',
				board_id: 'board-2',
				row_index: 1,
				col_index: 2,
				label: 'apple',
				action: { kind: 'speak_immediately', phrase: 'apple' }
			})
		]);
	});

	it('delete_button removes that Button', () => {
		const projected = projectVocabulary(
			live({
				boards: [board({ id: 'board-1' })],
				buttons: [button({ id: 'btn-1' }), button({ id: 'btn-2', label: 'go', col_index: 1 })]
			}),
			[{ op: 'delete_button', id: 'btn-1' }]
		);

		expect(projected.buttons.map((b) => b.id)).toEqual(['btn-2']);
	});

	it('creates and updates a Palette Color', () => {
		const projected = projectVocabulary(live(), [
			{
				op: 'create_palette_color',
				id: 'color-1',
				hex: '#aabbcc',
				name: 'Nouns',
				description: 'things',
				position: 0
			},
			{ op: 'update_palette_color', id: 'color-1', hex: '#112233', name: 'People' }
		]);

		expect(projected.paletteColors).toEqual([
			expect.objectContaining({
				id: 'color-1',
				vocabulary_id: 'vocab-1',
				hex: '#112233',
				name: 'People',
				description: 'things',
				position: 0
			})
		]);
	});
});
