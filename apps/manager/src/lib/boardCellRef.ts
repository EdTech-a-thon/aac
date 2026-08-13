/** Spreadsheet-style column letters: 0 → A, 25 → Z, 26 → AA, … */
export function columnLetter(colIndex: number): string {
	if (!Number.isInteger(colIndex) || colIndex < 0) return '?';
	let n = colIndex + 1;
	let result = '';
	while (n > 0) {
		const rem = (n - 1) % 26;
		result = String.fromCharCode(65 + rem) + result;
		n = Math.floor((n - 1) / 26);
	}
	return result;
}

/** 0-based row → 1-based display number. */
export function rowNumber(rowIndex: number): number {
	return rowIndex + 1;
}

/** Cell reference like "A3" from 0-based row/col indices. */
export function cellRef(rowIndex: number, colIndex: number): string {
	return `${columnLetter(colIndex)}${rowNumber(rowIndex)}`;
}
