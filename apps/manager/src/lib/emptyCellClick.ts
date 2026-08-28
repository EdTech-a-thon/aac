export type EmptyCellClickAction = 'create-button' | 'select-inclusion';

export function emptyCellClickAction(
	_hasSelection: boolean,
	hasCoveringInclusion: boolean
): EmptyCellClickAction {
	return hasCoveringInclusion ? 'select-inclusion' : 'create-button';
}
