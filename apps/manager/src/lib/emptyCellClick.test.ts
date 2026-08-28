import { describe, expect, it } from 'vitest';
import { emptyCellClickAction } from './emptyCellClick';

	describe('emptyCellClickAction', () => {
	it('creates a button on an empty cell even when another item is selected', () => {
		expect(emptyCellClickAction(true, false)).toBe('create-button');
	});

	it('selects a covering inclusion instead of creating a host button', () => {
		expect(emptyCellClickAction(true, true)).toBe('select-inclusion');
	});
});
