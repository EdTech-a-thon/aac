import { actionKey, type ButtonAction } from './buttonAction';

export type BoardSnapshot = {
	id: string;
	name: string;
	width: number;
	height: number;
	kind?: 'board' | 'snippet';
};

export type ButtonSnapshot = {
	id: string;
	board_id: string;
	row_index: number;
	col_index: number;
	label: string;
	background_color: string | null;
	palette_color_id: string | null;
	action: ButtonAction | null;
	symbol_digest: string | null;
};

export type PaletteColorSnapshot = {
	id: string;
	hex: string;
	name: string;
	description: string;
	position: number;
};

export type InclusionSnapshot = {
	id: string;
	host_id: string;
	snippet_id: string;
	origin_row: number;
	origin_col: number;
};

export type ChangeSetMutation =
	| {
			op: 'create_board';
			id: string;
			name: string;
			width: number;
			height: number;
			kind?: 'board' | 'snippet';
	  }
	| {
			op: 'update_board';
			id: string;
			name?: string;
			width?: number;
			height?: number;
	  }
	| { op: 'delete_board'; id: string }
	| {
			op: 'create_button';
			id: string;
			board_id: string;
			row_index: number;
			col_index: number;
			label: string;
			background_color?: string | null;
			palette_color_id?: string | null;
			action?: ButtonAction | null;
			symbol_digest?: string | null;
	  }
	| {
			op: 'update_button';
			id: string;
			board_id?: string;
			row_index?: number;
			col_index?: number;
			label?: string;
			background_color?: string | null;
			palette_color_id?: string | null;
			action?: ButtonAction | null;
			symbol_digest?: string | null;
	  }
	| { op: 'delete_button'; id: string }
	| {
			op: 'create_palette_color';
			id: string;
			hex: string;
			name: string;
			description: string;
			position: number;
	  }
	| {
			op: 'update_palette_color';
			id: string;
			hex?: string;
			name?: string;
			description?: string;
			position?: number;
	  }
	| { op: 'delete_palette_color'; id: string }
	| {
			op: 'create_snippet_inclusion';
			id: string;
			host_id: string;
			snippet_id: string;
			origin_row: number;
			origin_col: number;
	  }
	| {
			op: 'update_snippet_inclusion';
			id: string;
			origin_row?: number;
			origin_col?: number;
	  }
	| { op: 'delete_snippet_inclusion'; id: string };

function boardKey(board: BoardSnapshot) {
	return `${board.name}\0${board.width}\0${board.height}\0${board.kind ?? 'board'}`;
}

function buttonKey(button: ButtonSnapshot) {
	return `${button.board_id}\0${button.row_index}\0${button.col_index}\0${button.label}\0${button.background_color ?? ''}\0${button.palette_color_id ?? ''}\0${actionKey(button.action)}\0${button.symbol_digest ?? ''}`;
}

/** Diff last-synced server snapshots against current local editor state. */
export function diffBoardButtonMutations(
	baseBoards: BoardSnapshot[],
	baseButtons: ButtonSnapshot[],
	currentBoards: BoardSnapshot[],
	currentButtons: ButtonSnapshot[]
): ChangeSetMutation[] {
	const mutations: ChangeSetMutation[] = [];
	const baseBoardMap = new Map(baseBoards.map((b) => [b.id, b]));
	const currentBoardMap = new Map(currentBoards.map((b) => [b.id, b]));
	const baseButtonMap = new Map(baseButtons.map((b) => [b.id, b]));
	const currentButtonMap = new Map(currentButtons.map((b) => [b.id, b]));

	for (const board of currentBoards) {
		const base = baseBoardMap.get(board.id);
		if (!base) {
			const create: Extract<ChangeSetMutation, { op: 'create_board' }> = {
				op: 'create_board',
				id: board.id,
				name: board.name,
				width: board.width,
				height: board.height
			};
			if (board.kind === 'snippet') create.kind = 'snippet';
			mutations.push(create);
		} else if (boardKey(base) !== boardKey(board)) {
			const update: Extract<ChangeSetMutation, { op: 'update_board' }> = {
				op: 'update_board',
				id: board.id
			};
			if (base.name !== board.name) update.name = board.name;
			if (base.width !== board.width) update.width = board.width;
			if (base.height !== board.height) update.height = board.height;
			mutations.push(update);
		}
	}

	for (const board of baseBoards) {
		if (!currentBoardMap.has(board.id)) {
			mutations.push({ op: 'delete_board', id: board.id });
		}
	}

	for (const button of currentButtons) {
		const base = baseButtonMap.get(button.id);
		if (!base) {
			const create: Extract<ChangeSetMutation, { op: 'create_button' }> = {
				op: 'create_button',
				id: button.id,
				board_id: button.board_id,
				row_index: button.row_index,
				col_index: button.col_index,
				label: button.label
			};
			if (button.palette_color_id) {
				create.palette_color_id = button.palette_color_id;
			} else if (button.background_color) {
				create.background_color = button.background_color;
			} else {
				create.background_color = null;
				create.palette_color_id = null;
			}
			if (button.action) create.action = button.action;
			if (button.symbol_digest) create.symbol_digest = button.symbol_digest;
			mutations.push(create);
		} else if (buttonKey(base) !== buttonKey(button)) {
			const update: Extract<ChangeSetMutation, { op: 'update_button' }> = {
				op: 'update_button',
				id: button.id
			};
			if (base.board_id !== button.board_id) update.board_id = button.board_id;
			// Position is an absolute (row, col) pair — always emit both so applying a
			// suggestion last-write-wins the whole cell, not a sparse axis patch.
			if (base.row_index !== button.row_index || base.col_index !== button.col_index) {
				update.row_index = button.row_index;
				update.col_index = button.col_index;
			}
			if (base.label !== button.label) update.label = button.label;
			if (
				base.background_color !== button.background_color ||
				base.palette_color_id !== button.palette_color_id
			) {
				update.background_color = button.background_color;
				update.palette_color_id = button.palette_color_id;
			}
			if (actionKey(base.action) !== actionKey(button.action)) {
				update.action = button.action;
			}
			if (base.symbol_digest !== button.symbol_digest) {
				update.symbol_digest = button.symbol_digest;
			}
			mutations.push(update);
		}
	}

	for (const button of baseButtons) {
		if (!currentButtonMap.has(button.id)) {
			// Skipping buttons whose board is being deleted — cascade covers them.
			if (!currentBoardMap.has(button.board_id) && baseBoardMap.has(button.board_id)) {
				continue;
			}
			mutations.push({ op: 'delete_button', id: button.id });
		}
	}

	return mutations;
}

function paletteKey(color: PaletteColorSnapshot) {
	return `${color.hex}\0${color.name}\0${color.description}\0${color.position}`;
}

/** Diff last-synced Palette against current local editor state. */
export function diffPaletteMutations(
	baseColors: PaletteColorSnapshot[],
	currentColors: PaletteColorSnapshot[]
): ChangeSetMutation[] {
	const mutations: ChangeSetMutation[] = [];
	const baseMap = new Map(baseColors.map((c) => [c.id, c]));
	const currentMap = new Map(currentColors.map((c) => [c.id, c]));

	for (const color of currentColors) {
		const base = baseMap.get(color.id);
		if (!base) {
			mutations.push({
				op: 'create_palette_color',
				id: color.id,
				hex: color.hex,
				name: color.name,
				description: color.description,
				position: color.position
			});
		} else if (paletteKey(base) !== paletteKey(color)) {
			const update: Extract<ChangeSetMutation, { op: 'update_palette_color' }> = {
				op: 'update_palette_color',
				id: color.id
			};
			if (base.hex !== color.hex) update.hex = color.hex;
			if (base.name !== color.name) update.name = color.name;
			if (base.description !== color.description) update.description = color.description;
			if (base.position !== color.position) update.position = color.position;
			mutations.push(update);
		}
	}

	for (const color of baseColors) {
		if (!currentMap.has(color.id)) {
			mutations.push({ op: 'delete_palette_color', id: color.id });
		}
	}

	return mutations;
}

function inclusionKey(inclusion: InclusionSnapshot) {
	return `${inclusion.host_id}\0${inclusion.snippet_id}\0${inclusion.origin_row}\0${inclusion.origin_col}`;
}

/** Diff last-synced Snippet Inclusions against current local editor state. */
export function diffSnippetInclusionMutations(
	baseInclusions: InclusionSnapshot[],
	currentInclusions: InclusionSnapshot[],
	currentHostIds: Set<string>
): ChangeSetMutation[] {
	const mutations: ChangeSetMutation[] = [];
	const baseMap = new Map(baseInclusions.map((inc) => [inc.id, inc]));
	const currentMap = new Map(currentInclusions.map((inc) => [inc.id, inc]));

	for (const inclusion of currentInclusions) {
		const base = baseMap.get(inclusion.id);
		if (!base) {
			mutations.push({
				op: 'create_snippet_inclusion',
				id: inclusion.id,
				host_id: inclusion.host_id,
				snippet_id: inclusion.snippet_id,
				origin_row: inclusion.origin_row,
				origin_col: inclusion.origin_col
			});
		} else if (inclusionKey(base) !== inclusionKey(inclusion)) {
			const update: Extract<ChangeSetMutation, { op: 'update_snippet_inclusion' }> = {
				op: 'update_snippet_inclusion',
				id: inclusion.id
			};
			if (base.origin_row !== inclusion.origin_row) update.origin_row = inclusion.origin_row;
			if (base.origin_col !== inclusion.origin_col) update.origin_col = inclusion.origin_col;
			mutations.push(update);
		}
	}

	for (const inclusion of baseInclusions) {
		if (currentMap.has(inclusion.id)) continue;
		if (!currentHostIds.has(inclusion.host_id)) continue;
		mutations.push({ op: 'delete_snippet_inclusion', id: inclusion.id });
	}

	return mutations;
}
