import { BUTTON_ACTION_KIND_OPTIONS, type ButtonAction } from './buttonAction';
import { cellRef, columnLetter, rowNumber } from './boardCellRef';
import type { ChangeSetMutation } from './changeSetMutations';
import type { MutationLookupContext } from './describeChangeSetMutations';
import { describeChangeSetMutations } from './describeChangeSetMutations';

export type PreviewButton = {
	id: string;
	board_id: string;
	label: string;
	row_index: number;
	col_index: number;
	background_color: string | null;
	palette_color_id: string | null;
};

export type PreviewOverlay =
	| { kind: 'create'; row: number; col: number; label: string }
	| { kind: 'delete'; row: number; col: number }
	| { kind: 'update'; row: number; col: number }
	| {
			kind: 'move';
			fromRow: number;
			fromCol: number;
			toRow: number;
			toCol: number;
	  };

export type SuggestedChangeGroup =
	| {
			kind: 'create_board';
			key: string;
			boardId: string;
			name: string;
			width: number;
			height: number;
			summary: string;
			buttons: PreviewButton[];
			overlays: PreviewOverlay[];
			changeLines: string[];
	  }
	| {
			kind: 'delete_board';
			key: string;
			boardId: string;
			name: string;
			width: number;
			height: number;
			buttons: PreviewButton[];
			summary: string;
			changeLines: string[];
	  }
	| {
			kind: 'board';
			key: string;
			boardId: string;
			name: string;
			width: number;
			height: number;
			buttons: PreviewButton[];
			overlays: PreviewOverlay[];
			changeLines: string[];
	  }
	| {
			kind: 'palette';
			key: string;
			changeLines: string[];
	  };

export type RichLookupContext = MutationLookupContext & {
	buttons: Array<
		MutationLookupContext['buttons'][number] & {
			background_color?: string | null;
			palette_color_id?: string | null;
		}
	>;
};

function displayName(name: string | null | undefined) {
	const trimmed = name?.trim();
	return trimmed ? trimmed : 'Untitled';
}

function buttonPhrase(label: string | null | undefined) {
	const trimmed = label?.trim();
	return trimmed ? `'${trimmed}' button` : 'untitled button';
}

function actionSummary(action: ButtonAction | null | undefined, ctx: MutationLookupContext): string {
	if (!action) return 'no Action';
	const label =
		BUTTON_ACTION_KIND_OPTIONS.find((option) => option.kind === action.kind)?.label ?? action.kind;
	switch (action.kind) {
		case 'insert_phrase':
		case 'speak_immediately':
			return `${label} (“${action.phrase}”)`;
		case 'open_board': {
			const board = ctx.boards.find((b) => b.id === action.board_id);
			return `${label} (“${displayName(board?.name)}”)`;
		}
		case 'play_youtube_clip':
			return `${label} (${action.video_id}, ${action.start}–${action.end}s)`;
		default:
			return label;
	}
}

function colorSummary(
	ctx: MutationLookupContext,
	paletteColorId: string | null | undefined,
	backgroundColor: string | null | undefined
): string {
	if (paletteColorId) {
		const color = ctx.paletteColors.find((c) => c.id === paletteColorId);
		if (color) {
			const name = color.name.trim();
			return name ? `Palette Color “${name}” (${color.hex})` : `Palette Color (${color.hex})`;
		}
		return 'a Palette Color';
	}
	if (backgroundColor) return `custom ${backgroundColor}`;
	return 'None';
}

/** Describe a change without repeating the board name (used inside a board group). */
export function describeScopedChange(
	mutation: ChangeSetMutation,
	ctx: MutationLookupContext
): string {
	switch (mutation.op) {
		case 'update_board': {
			const parts: string[] = [];
			if (mutation.name !== undefined) parts.push(`Rename to “${displayName(mutation.name)}”`);
			if (mutation.width !== undefined || mutation.height !== undefined) {
				const board = ctx.boards.find((b) => b.id === mutation.id);
				const width = mutation.width ?? board?.width;
				const height = mutation.height ?? board?.height;
				if (width !== undefined && height !== undefined) {
					parts.push(`Resize to ${width}×${height}`);
				} else if (mutation.width !== undefined) {
					parts.push(`Set width to ${mutation.width}`);
				} else if (mutation.height !== undefined) {
					parts.push(`Set height to ${mutation.height}`);
				}
			}
			return parts.length > 0 ? parts.join('; ') : 'Update board';
		}
		case 'create_button': {
			const parts = [
				`Create ${buttonPhrase(mutation.label)} at ${cellRef(mutation.row_index, mutation.col_index)}`
			];
			if (
				mutation.palette_color_id !== undefined ||
				mutation.background_color !== undefined
			) {
				parts.push(
					`color ${colorSummary(ctx, mutation.palette_color_id, mutation.background_color)}`
				);
			}
			if (mutation.action !== undefined) {
				parts.push(`Action ${actionSummary(mutation.action, ctx)}`);
			}
			return parts.join('; ');
		}
		case 'update_button': {
			const existing = ctx.buttons.find((b) => b.id === mutation.id);
			const phrase = existing ? buttonPhrase(existing.label) : 'button';
			const parts: string[] = [];
			if (mutation.board_id !== undefined) {
				const dest = ctx.boards.find((b) => b.id === mutation.board_id);
				parts.push(`move to board “${displayName(dest?.name)}”`);
			}
			if (mutation.row_index !== undefined && mutation.col_index !== undefined) {
				parts.push(`move to ${cellRef(mutation.row_index, mutation.col_index)}`);
			} else if (mutation.row_index !== undefined) {
				parts.push(`set row to ${rowNumber(mutation.row_index)}`);
			} else if (mutation.col_index !== undefined) {
				parts.push(`set column to ${columnLetter(mutation.col_index)}`);
			}
			if (mutation.label !== undefined) {
				parts.push(
					mutation.label.trim()
						? `rename to “${mutation.label.trim()}”`
						: 'clear label'
				);
			}
			if (
				mutation.palette_color_id !== undefined ||
				mutation.background_color !== undefined
			) {
				parts.push(
					`set color to ${colorSummary(ctx, mutation.palette_color_id, mutation.background_color)}`
				);
			}
			if (mutation.action !== undefined) {
				parts.push(`set Action to ${actionSummary(mutation.action, ctx)}`);
			}
			const detail = parts.length > 0 ? `: ${parts.join('; ')}` : '';
			return `Update ${phrase}${detail}`;
		}
		case 'delete_button': {
			const existing = ctx.buttons.find((b) => b.id === mutation.id);
			if (!existing) return 'Delete button';
			return `Delete ${buttonPhrase(existing.label)} at ${cellRef(existing.row_index, existing.col_index)}`;
		}
		default:
			return describeChangeSetMutations([mutation], ctx)[0] ?? 'Change';
	}
}

function toPreviewButton(
	button: RichLookupContext['buttons'][number]
): PreviewButton {
	return {
		id: button.id,
		board_id: button.board_id,
		label: button.label,
		row_index: button.row_index,
		col_index: button.col_index,
		background_color: button.background_color ?? null,
		palette_color_id: button.palette_color_id ?? null
	};
}

/** Apply board-scoped button mutations to produce the post-suggestion preview state. */
export function applyPreviewButtons(
	boardId: string,
	baseButtons: RichLookupContext['buttons'],
	mutations: ChangeSetMutation[]
): PreviewButton[] {
	const buttons = new Map<string, PreviewButton>();
	for (const button of baseButtons) {
		if (button.board_id === boardId) {
			buttons.set(button.id, toPreviewButton(button));
		}
	}

	for (const mutation of mutations) {
		if (mutation.op === 'create_button' && mutation.board_id === boardId) {
			buttons.set(mutation.id, {
				id: mutation.id,
				board_id: mutation.board_id,
				label: mutation.label,
				row_index: mutation.row_index,
				col_index: mutation.col_index,
				background_color:
					mutation.background_color !== undefined ? mutation.background_color : null,
				palette_color_id:
					mutation.palette_color_id !== undefined ? mutation.palette_color_id : null
			});
			continue;
		}

		if (mutation.op === 'delete_button') {
			buttons.delete(mutation.id);
			continue;
		}

		if (mutation.op !== 'update_button') continue;

		const existing =
			buttons.get(mutation.id) ??
			(() => {
				const fromBase = baseButtons.find((b) => b.id === mutation.id);
				return fromBase ? toPreviewButton(fromBase) : null;
			})();
		if (!existing) continue;

		const nextBoardId = mutation.board_id ?? existing.board_id;
		if (existing.board_id === boardId && nextBoardId !== boardId) {
			buttons.delete(mutation.id);
			continue;
		}
		if (nextBoardId !== boardId) continue;

		buttons.set(mutation.id, {
			id: mutation.id,
			board_id: nextBoardId,
			label: mutation.label !== undefined ? mutation.label : existing.label,
			row_index: mutation.row_index !== undefined ? mutation.row_index : existing.row_index,
			col_index: mutation.col_index !== undefined ? mutation.col_index : existing.col_index,
			background_color:
				mutation.background_color !== undefined
					? mutation.background_color
					: existing.background_color,
			palette_color_id:
				mutation.palette_color_id !== undefined
					? mutation.palette_color_id
					: existing.palette_color_id
		});
	}

	return [...buttons.values()];
}

/** Apply Palette mutations for resolving button colors in the after-state preview. */
export function applyPreviewPalette(
	baseColors: RichLookupContext['paletteColors'],
	mutations: ChangeSetMutation[]
): Record<string, string> {
	const colors = new Map(baseColors.map((c) => [c.id, { ...c }]));
	for (const mutation of mutations) {
		if (mutation.op === 'create_palette_color') {
			colors.set(mutation.id, {
				id: mutation.id,
				name: mutation.name,
				hex: mutation.hex
			});
		} else if (mutation.op === 'update_palette_color') {
			const existing = colors.get(mutation.id);
			if (!existing) continue;
			colors.set(mutation.id, {
				...existing,
				hex: mutation.hex !== undefined ? mutation.hex : existing.hex,
				name: mutation.name !== undefined ? mutation.name : existing.name
			});
		} else if (mutation.op === 'delete_palette_color') {
			colors.delete(mutation.id);
		}
	}
	const map: Record<string, string> = {};
	for (const color of colors.values()) {
		map[color.id] = color.hex;
	}
	return map;
}

function buildOverlays(
	mutations: ChangeSetMutation[],
	ctx: RichLookupContext,
	boardId: string
): PreviewOverlay[] {
	const overlays: PreviewOverlay[] = [];

	for (const mutation of mutations) {
		if (mutation.op === 'create_button' && mutation.board_id === boardId) {
			overlays.push({
				kind: 'create',
				row: mutation.row_index,
				col: mutation.col_index,
				label: mutation.label
			});
			continue;
		}

		if (mutation.op === 'delete_button') {
			const existing = ctx.buttons.find((b) => b.id === mutation.id);
			if (existing && existing.board_id === boardId) {
				overlays.push({
					kind: 'delete',
					row: existing.row_index,
					col: existing.col_index
				});
			}
			continue;
		}

		if (mutation.op !== 'update_button') continue;

		const existing = ctx.buttons.find((b) => b.id === mutation.id);
		if (!existing) continue;

		const movingBoards =
			mutation.board_id !== undefined && mutation.board_id !== existing.board_id;
		const movingCells =
			mutation.row_index !== undefined &&
			mutation.col_index !== undefined &&
			(mutation.row_index !== existing.row_index ||
				mutation.col_index !== existing.col_index ||
				movingBoards);

		if (movingBoards) {
			if (existing.board_id === boardId) {
				overlays.push({
					kind: 'delete',
					row: existing.row_index,
					col: existing.col_index
				});
			}
			if (mutation.board_id === boardId) {
				overlays.push({
					kind: 'create',
					row: mutation.row_index ?? existing.row_index,
					col: mutation.col_index ?? existing.col_index,
					label: mutation.label ?? existing.label
				});
			}
			continue;
		}

		if (existing.board_id !== boardId) continue;

		if (movingCells && mutation.row_index !== undefined && mutation.col_index !== undefined) {
			overlays.push({
				kind: 'move',
				fromRow: existing.row_index,
				fromCol: existing.col_index,
				toRow: mutation.row_index,
				toCol: mutation.col_index
			});
			// Also ring the destination when non-position fields change.
			if (
				mutation.label !== undefined ||
				mutation.background_color !== undefined ||
				mutation.palette_color_id !== undefined ||
				mutation.action !== undefined
			) {
				overlays.push({
					kind: 'update',
					row: mutation.row_index,
					col: mutation.col_index
				});
			}
		} else {
			overlays.push({
				kind: 'update',
				row: existing.row_index,
				col: existing.col_index
			});
		}
	}

	return overlays;
}

/**
 * Group Change Set changes for the suggestion preview UI:
 * top-level create/delete board, per-board boxes, and palette.
 */
export function groupSuggestedChanges(
	mutations: ChangeSetMutation[],
	ctx: RichLookupContext
): SuggestedChangeGroup[] {
	const createdBoardIds = new Set(
		mutations.filter((m) => m.op === 'create_board').map((m) => m.id)
	);
	const deletedBoardIds = new Set(
		mutations.filter((m) => m.op === 'delete_board').map((m) => m.id)
	);

	const byBoard = new Map<string, ChangeSetMutation[]>();
	const paletteMutations: ChangeSetMutation[] = [];
	const topLevel: SuggestedChangeGroup[] = [];

	function pushBoard(boardId: string, mutation: ChangeSetMutation) {
		const list = byBoard.get(boardId) ?? [];
		list.push(mutation);
		byBoard.set(boardId, list);
	}

	for (const mutation of mutations) {
		switch (mutation.op) {
			case 'create_board':
				topLevel.push({
					kind: 'create_board',
					key: `create-board-${mutation.id}`,
					boardId: mutation.id,
					name: displayName(mutation.name),
					width: mutation.width,
					height: mutation.height,
					summary: `Create board “${displayName(mutation.name)}” (${mutation.width}×${mutation.height})`,
					buttons: [],
					overlays: [],
					changeLines: []
				});
				break;
			case 'delete_board': {
				const board = ctx.boards.find((b) => b.id === mutation.id);
				topLevel.push({
					kind: 'delete_board',
					key: `delete-board-${mutation.id}`,
					boardId: mutation.id,
					name: displayName(board?.name),
					width: board?.width ?? 1,
					height: board?.height ?? 1,
					buttons: ctx.buttons
						.filter((b) => b.board_id === mutation.id)
						.map(toPreviewButton),
					summary: `Delete board “${displayName(board?.name)}”`,
					changeLines: ['Remove this board and its buttons']
				});
				break;
			}
			case 'update_board':
				if (!deletedBoardIds.has(mutation.id)) pushBoard(mutation.id, mutation);
				break;
			case 'create_button':
				if (!deletedBoardIds.has(mutation.board_id)) pushBoard(mutation.board_id, mutation);
				break;
			case 'update_button': {
				const existing = ctx.buttons.find((b) => b.id === mutation.id);
				if (existing && !deletedBoardIds.has(existing.board_id)) {
					pushBoard(existing.board_id, mutation);
				}
				if (
					mutation.board_id &&
					mutation.board_id !== existing?.board_id &&
					!deletedBoardIds.has(mutation.board_id)
				) {
					pushBoard(mutation.board_id, mutation);
				}
				break;
			}
			case 'delete_button': {
				const existing = ctx.buttons.find((b) => b.id === mutation.id);
				if (existing && !deletedBoardIds.has(existing.board_id)) {
					pushBoard(existing.board_id, mutation);
				}
				break;
			}
			case 'create_palette_color':
			case 'update_palette_color':
			case 'delete_palette_color':
				paletteMutations.push(mutation);
				break;
		}
	}

	// Attach button/board-update changes onto create_board groups.
	for (let i = 0; i < topLevel.length; i++) {
		const group = topLevel[i];
		if (group.kind !== 'create_board') continue;
		const nested = byBoard.get(group.boardId) ?? [];
		byBoard.delete(group.boardId);
		topLevel[i] = {
			...group,
			buttons: applyPreviewButtons(group.boardId, ctx.buttons, nested),
			overlays: buildOverlays(nested, ctx, group.boardId),
			changeLines: nested.map((m) => describeScopedChange(m, ctx))
		};
	}

	const boardGroups: SuggestedChangeGroup[] = [];
	for (const [boardId, boardMutations] of byBoard) {
		if (createdBoardIds.has(boardId) || deletedBoardIds.has(boardId)) continue;
		const board = ctx.boards.find((b) => b.id === boardId);
		const updateBoard = boardMutations.find(
			(m): m is Extract<ChangeSetMutation, { op: 'update_board' }> => m.op === 'update_board'
		);
		boardGroups.push({
			kind: 'board',
			key: `board-${boardId}`,
			boardId,
			name: displayName(updateBoard?.name ?? board?.name),
			width: updateBoard?.width ?? board?.width ?? 1,
			height: updateBoard?.height ?? board?.height ?? 1,
			buttons: applyPreviewButtons(boardId, ctx.buttons, boardMutations),
			overlays: buildOverlays(boardMutations, ctx, boardId),
			changeLines: boardMutations.map((m) => describeScopedChange(m, ctx))
		});
	}

	const result = [...topLevel, ...boardGroups];
	if (paletteMutations.length > 0) {
		result.push({
			kind: 'palette',
			key: 'palette',
			changeLines: describeChangeSetMutations(paletteMutations, ctx)
		});
	}
	return result;
}
