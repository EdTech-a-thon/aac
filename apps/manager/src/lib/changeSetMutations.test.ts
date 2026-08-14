import { describe, expect, it } from 'vitest';
import { diffBoardButtonMutations, diffSnippetInclusionMutations } from './changeSetMutations';

describe('diffBoardButtonMutations Action', () => {
	it('includes Action on create_button and update_button when it changes', () => {
		const board = { id: 'board-1', name: 'Home', width: 2, height: 2 };
		const baseButton = {
			id: 'btn-1',
			board_id: 'board-1',
			row_index: 0,
			col_index: 0,
			label: 'Hi',
			background_color: '#FFFFFF',
			palette_color_id: null,
			action: null
		};

		const createMutations = diffBoardButtonMutations(
			[board],
			[],
			[board],
			[
				{
					...baseButton,
					action: { kind: 'insert_phrase', phrase: 'hello' }
				}
			]
		);
		expect(createMutations).toEqual([
			expect.objectContaining({
				op: 'create_button',
				id: 'btn-1',
				action: { kind: 'insert_phrase', phrase: 'hello' }
			})
		]);

		const updateMutations = diffBoardButtonMutations(
			[board],
			[baseButton],
			[board],
			[
				{
					...baseButton,
					action: { kind: 'backspace' }
				}
			]
		);
		expect(updateMutations).toEqual([
			{
				op: 'update_button',
				id: 'btn-1',
				action: { kind: 'backspace' }
			}
		]);

		const clearMutations = diffBoardButtonMutations(
			[board],
			[{ ...baseButton, action: { kind: 'backspace' } }],
			[board],
			[{ ...baseButton, action: null }]
		);
		expect(clearMutations).toEqual([
			{
				op: 'update_button',
				id: 'btn-1',
				action: null
			}
		]);
	});

	it('emits kind snippet on create_board for a Snippet', () => {
		expect(
			diffBoardButtonMutations(
				[],
				[],
				[{ id: 'snip-1', name: 'Strip', width: 6, height: 1, kind: 'snippet' }],
				[]
			)
		).toEqual([
			{
				op: 'create_board',
				id: 'snip-1',
				name: 'Strip',
				width: 6,
				height: 1,
				kind: 'snippet'
			}
		]);
	});
});

describe('diffSnippetInclusionMutations', () => {
	const inclusion = {
		id: 'inc-1',
		host_id: 'board-1',
		snippet_id: 'snip-1',
		origin_row: 0,
		origin_col: 0
	};

	it('emits create, origin update, and delete for Snippet Inclusions', () => {
		expect(
			diffSnippetInclusionMutations([], [inclusion], new Set(['board-1']))
		).toEqual([
			{
				op: 'create_snippet_inclusion',
				id: 'inc-1',
				host_id: 'board-1',
				snippet_id: 'snip-1',
				origin_row: 0,
				origin_col: 0
			}
		]);

		expect(
			diffSnippetInclusionMutations(
				[inclusion],
				[{ ...inclusion, origin_row: 1, origin_col: 2 }],
				new Set(['board-1'])
			)
		).toEqual([
			{
				op: 'update_snippet_inclusion',
				id: 'inc-1',
				origin_row: 1,
				origin_col: 2
			}
		]);

		expect(
			diffSnippetInclusionMutations([inclusion], [], new Set(['board-1']))
		).toEqual([{ op: 'delete_snippet_inclusion', id: 'inc-1' }]);
	});

	it('skips deleting an inclusion whose host Board is also being deleted', () => {
		expect(diffSnippetInclusionMutations([inclusion], [], new Set())).toEqual([]);
	});
});
