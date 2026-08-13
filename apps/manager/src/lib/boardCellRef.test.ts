import { describe, expect, it } from 'vitest';
import { cellRef, columnLetter, rowNumber } from './boardCellRef';

describe('boardCellRef', () => {
	it('letters columns starting at A', () => {
		expect(columnLetter(0)).toBe('A');
		expect(columnLetter(1)).toBe('B');
		expect(columnLetter(25)).toBe('Z');
		expect(columnLetter(26)).toBe('AA');
		expect(columnLetter(27)).toBe('AB');
	});

	it('numbers rows starting at 1', () => {
		expect(rowNumber(0)).toBe(1);
		expect(rowNumber(2)).toBe(3);
	});

	it('formats cell refs as letter+number', () => {
		expect(cellRef(0, 0)).toBe('A1');
		expect(cellRef(2, 3)).toBe('D3');
		expect(cellRef(1, 2)).toBe('C2');
	});
});
