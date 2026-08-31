import type { ButtonAction } from './buttonAction';

export type { ButtonAction };

export type Vocabulary = {
	id: string;
	name: string;
	description: string;
	displayName: string;
	created_at: string;
	updated_at: string;
};

export type GridKind = 'board' | 'snippet';

export function isSnippet(board: { kind?: GridKind }): boolean {
	return board.kind === 'snippet';
}

export type Board = {
	id: string;
	vocabulary_id: string;
	name: string;
	displayName: string;
	width: number;
	height: number;
	kind: GridKind;
	created_at: string;
	updated_at: string;
};

export type BoardButton = {
	id: string;
	board_id: string;
	row_index: number;
	col_index: number;
	label: string;
	background_color: string | null;
	palette_color_id: string | null;
	action: ButtonAction | null;
	symbol_digest: string | null;
	created_at: string;
	updated_at: string;
};

export type SnippetInclusion = {
	id: string;
	host_id: string;
	snippet_id: string;
	origin_row: number;
	origin_col: number;
	created_at: string;
	updated_at: string;
};

export type UnresolvedCopyAction = {
	id: string;
	vocabulary_id: string;
	button_id: string;
	previous_board_name: string;
	created_at: string;
};

export type PaletteColor = {
	id: string;
	vocabulary_id: string;
	hex: string;
	name: string;
	description: string;
	position: number;
	created_at: string;
	updated_at: string;
};

export type Manager = {
	userId: string;
	email: string | null;
	name: string | null;
	createdAt: string;
};

export type Communicator = {
	userId: string;
	email: string | null;
	name: string | null;
	createdAt: string;
};

export type ShareLink = {
	id: string;
	token: string;
	vocabulary_id: string;
	board_id: string | null;
	created_at: string;
};
