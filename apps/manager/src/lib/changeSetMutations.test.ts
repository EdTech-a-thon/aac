import { describe, expect, it } from 'vitest';
import { diffBoardButtonMutations } from './changeSetMutations';

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
});
