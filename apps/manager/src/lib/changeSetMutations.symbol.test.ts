import { describe, expect, it } from 'vitest';
import { diffBoardButtonMutations, type ButtonSnapshot } from './changeSetMutations';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

const board = { id: 'board-1', name: 'Home', width: 2, height: 2 };

function button(partial: Partial<ButtonSnapshot> = {}): ButtonSnapshot {
	return {
		id: 'btn-1',
		board_id: 'board-1',
		row_index: 0,
		col_index: 0,
		label: 'drink',
		background_color: null,
		palette_color_id: null,
		action: null,
		symbol_digest: null,
		...partial
	};
}

describe('diffBoardButtonMutations Symbol', () => {
	it('carries a Symbol on create_button', () => {
		const mutations = diffBoardButtonMutations(
			[board],
			[],
			[board],
			[button({ symbol_digest: DIGEST_A })]
		);
		expect(mutations).toEqual([
			expect.objectContaining({ op: 'create_button', id: 'btn-1', symbol_digest: DIGEST_A })
		]);
	});

	it('omits the Symbol on create_button when the Button has none', () => {
		const [mutation] = diffBoardButtonMutations([board], [], [board], [button()]);
		expect(mutation).not.toHaveProperty('symbol_digest');
	});

	it('emits an update when only the Symbol changes', () => {
		const mutations = diffBoardButtonMutations(
			[board],
			[button({ symbol_digest: DIGEST_A })],
			[board],
			[button({ symbol_digest: DIGEST_B })]
		);
		expect(mutations).toEqual([
			expect.objectContaining({ op: 'update_button', id: 'btn-1', symbol_digest: DIGEST_B })
		]);
	});

	it('emits an update carrying null when the Symbol is cleared', () => {
		const mutations = diffBoardButtonMutations(
			[board],
			[button({ symbol_digest: DIGEST_A })],
			[board],
			[button({ symbol_digest: null })]
		);
		expect(mutations).toEqual([
			expect.objectContaining({ op: 'update_button', id: 'btn-1', symbol_digest: null })
		]);
	});

	it('emits an update when a Symbol is added to a Button that had none', () => {
		const mutations = diffBoardButtonMutations(
			[board],
			[button()],
			[board],
			[button({ symbol_digest: DIGEST_A })]
		);
		expect(mutations).toEqual([
			expect.objectContaining({ op: 'update_button', symbol_digest: DIGEST_A })
		]);
	});

	it('does not mention the Symbol when only the label changed', () => {
		const [mutation] = diffBoardButtonMutations(
			[board],
			[button({ symbol_digest: DIGEST_A })],
			[board],
			[button({ symbol_digest: DIGEST_A, label: 'eat' })]
		);
		expect(mutation).not.toHaveProperty('symbol_digest');
	});

	it('produces no mutation when nothing changed', () => {
		expect(
			diffBoardButtonMutations(
				[board],
				[button({ symbol_digest: DIGEST_A })],
				[board],
				[button({ symbol_digest: DIGEST_A })]
			)
		).toEqual([]);
	});
});
