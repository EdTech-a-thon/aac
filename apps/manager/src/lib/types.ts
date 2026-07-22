import type { ButtonAction } from './buttonAction';

export type { ButtonAction };

export type Vocabulary = {
	id: string;
	name: string;
	displayName: string;
	created_at: string;
	updated_at: string;
};

export type Board = {
	id: string;
	vocabulary_id: string;
	name: string;
	displayName: string;
	width: number;
	height: number;
	created_at: string;
	updated_at: string;
};

export type BoardButton = {
	id: string;
	board_id: string;
	row_index: number;
	col_index: number;
	label: string;
	background_color: string;
	action: ButtonAction | null;
	created_at: string;
	updated_at: string;
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
