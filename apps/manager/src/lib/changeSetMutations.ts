import { actionKey, type ButtonAction } from './buttonAction';

export type BoardSnapshot = {
	id: string;
	name: string;
	width: number;
	height: number;
};

export type ButtonSnapshot = {
	id: string;
	board_id: string;
	row_index: number;
	col_index: number;
	label: string;
	background_color: string;
	action: ButtonAction | null;
};

export type ChangeSetMutation =
	| {
			op: 'create_board';
			id: string;
			name: string;
			width: number;
			height: number;
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
			background_color: string;
			action?: ButtonAction | null;
	  }
	| {
			op: 'update_button';
			id: string;
			board_id?: string;
			row_index?: number;
			col_index?: number;
			label?: string;
			background_color?: string;
			action?: ButtonAction | null;
	  }
	| { op: 'delete_button'; id: string };

function boardKey(board: BoardSnapshot) {
	return `${board.name}\0${board.width}\0${board.height}`;
}

function buttonKey(button: ButtonSnapshot) {
	return `${button.board_id}\0${button.row_index}\0${button.col_index}\0${button.label}\0${button.background_color}\0${actionKey(button.action)}`;
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
			mutations.push({
				op: 'create_board',
				id: board.id,
				name: board.name,
				width: board.width,
				height: board.height
			});
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
				label: button.label,
				background_color: button.background_color
			};
			if (button.action) create.action = button.action;
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
			if (base.background_color !== button.background_color) {
				update.background_color = button.background_color;
			}
			if (actionKey(base.action) !== actionKey(button.action)) {
				update.action = button.action;
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
