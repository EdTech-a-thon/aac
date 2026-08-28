import { BUTTON_ACTION_KIND_OPTIONS, type ButtonAction } from './buttonAction';
import { cellRef, columnLetter, rowNumber } from './boardCellRef';
import type { ChangeSetMutation } from './changeSetMutations';
import type { MutationLookupContext } from './describeChangeSetMutations';
import {
	describeChangeSetMutations,
	lookupWithChangeSetBoards
} from './describeChangeSetMutations';
import { projectVocabulary, type ProjectedVocabulary } from './projectVocabulary';

export type PreviewButton = {
	id: string;
	board_id: string;
	label: string;
	row_index: number;
	col_index: number;
	background_color: string | null;
	palette_color_id: string | null;
	symbol_digest: string | null;
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
	  }
	| {
			kind: 'insert_snippet';
			row: number;
			col: number;
			width: number;
			height: number;
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
			summary: string;
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
			symbol_digest?: string | null;
		}
	>;
};

function gridNoun(kind?: 'board' | 'snippet') {
	return kind === 'snippet' ? 'snippet' : 'board';
}

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
			return parts.length > 0 ? parts.join('; ') : `Update ${gridNoun(ctx.boards.find((b) => b.id === mutation.id)?.kind)}`;
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
				parts.push(`move to ${gridNoun(dest?.kind)} “${displayName(dest?.name)}”`);
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
		case 'create_snippet_inclusion':
			return `Insert snippet “${displayName(ctx.boards.find((b) => b.id === mutation.snippet_id)?.name)}” at ${cellRef(mutation.origin_row, mutation.origin_col)}`;
		case 'update_snippet_inclusion': {
			const existing = (ctx.snippetInclusions ?? []).find((inc) => inc.id === mutation.id);
			const row = mutation.origin_row ?? existing?.origin_row;
			const col = mutation.origin_col ?? existing?.origin_col;
			if (row !== undefined && col !== undefined) {
				return `Move snippet inclusion to ${cellRef(row, col)}`;
			}
			return 'Move snippet inclusion';
		}
		case 'delete_snippet_inclusion': {
			const existing = (ctx.snippetInclusions ?? []).find((inc) => inc.id === mutation.id);
			if (!existing) return 'Remove snippet inclusion';
			return `Remove snippet inclusion of “${displayName(ctx.boards.find((b) => b.id === existing.snippet_id)?.name)}”`;
		}
		default:
			return describeChangeSetMutations([mutation], ctx)[0] ?? 'Change';
	}
}

function toPreviewButton(
	button: RichLookupContext['buttons'][number] | ProjectedVocabulary['buttons'][number]
): PreviewButton {
	return {
		id: button.id,
		board_id: button.board_id,
		label: button.label,
		row_index: button.row_index,
		col_index: button.col_index,
		background_color: button.background_color ?? null,
		palette_color_id: button.palette_color_id ?? null,
		symbol_digest: button.symbol_digest ?? null
	};
}

function liveFromLookup(ctx: RichLookupContext): ProjectedVocabulary {
	return {
		vocabularyId: '',
		boards: ctx.boards.map((b) => ({
			id: b.id,
			vocabulary_id: '',
			name: b.name,
			displayName: displayName(b.name),
			width: b.width,
			height: b.height,
			kind: b.kind === 'snippet' ? 'snippet' : 'board',
			created_at: '',
			updated_at: ''
		})),
		buttons: ctx.buttons.map((b: RichLookupContext['buttons'][number]) => ({
			id: b.id,
			board_id: b.board_id,
			row_index: b.row_index,
			col_index: b.col_index,
			label: b.label,
			background_color: b.background_color ?? null,
			palette_color_id: b.palette_color_id ?? null,
			action: null,
			symbol_digest: b.symbol_digest ?? null,
			created_at: '',
			updated_at: ''
		})),
		paletteColors: ctx.paletteColors.map((c, index) => ({
			id: c.id,
			vocabulary_id: '',
			hex: c.hex,
			name: c.name,
			description: '',
			position: index,
			created_at: '',
			updated_at: ''
		})),
		snippetInclusions: (ctx.snippetInclusions ?? []).map((inc) => ({
			id: inc.id,
			host_id: inc.host_id,
			snippet_id: inc.snippet_id,
			origin_row: inc.origin_row,
			origin_col: inc.origin_col,
			created_at: '',
			updated_at: ''
		}))
	};
}

function previewButtonsOnBoard(
	projected: ProjectedVocabulary,
	boardId: string
): PreviewButton[] {
	return projected.buttons.filter((button) => button.board_id === boardId).map(toPreviewButton);
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

		if (mutation.op === 'create_snippet_inclusion' && mutation.host_id === boardId) {
			const snippet = ctx.boards.find((board) => board.id === mutation.snippet_id);
			overlays.push({
				kind: 'insert_snippet',
				row: mutation.origin_row,
				col: mutation.origin_col,
				width: snippet?.width ?? 1,
				height: snippet?.height ?? 1
			});
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
	const descriptionCtx = lookupWithChangeSetBoards(ctx, mutations);
	const projected = projectVocabulary(liveFromLookup(descriptionCtx), mutations);
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
			case 'create_board': {
				const noun = gridNoun(mutation.kind);
				topLevel.push({
					kind: 'create_board',
					key: `create-board-${mutation.id}`,
					boardId: mutation.id,
					name: displayName(mutation.name),
					width: mutation.width,
					height: mutation.height,
					summary: `Create ${noun} “${displayName(mutation.name)}” (${mutation.width}×${mutation.height})`,
					buttons: [],
					overlays: [],
					changeLines: []
				});
				break;
			}
			case 'delete_board': {
				const board = ctx.boards.find((b) => b.id === mutation.id);
				const noun = gridNoun(board?.kind);
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
					summary: `Delete ${noun} “${displayName(board?.name)}”`,
					changeLines: [`Remove this ${noun} and its buttons`]
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
			case 'create_snippet_inclusion':
				if (!deletedBoardIds.has(mutation.host_id)) pushBoard(mutation.host_id, mutation);
				break;
			case 'update_snippet_inclusion':
			case 'delete_snippet_inclusion': {
				const existing = (ctx.snippetInclusions ?? []).find((inc) => inc.id === mutation.id);
				if (existing && !deletedBoardIds.has(existing.host_id)) {
					pushBoard(existing.host_id, mutation);
				}
				break;
			}
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
			buttons: previewButtonsOnBoard(projected, group.boardId),
			overlays: buildOverlays(nested, descriptionCtx, group.boardId),
			changeLines: nested.map((m) => describeScopedChange(m, descriptionCtx))
		};
	}

	const boardGroups: SuggestedChangeGroup[] = [];
	for (const [boardId, boardMutations] of byBoard) {
		if (createdBoardIds.has(boardId) || deletedBoardIds.has(boardId)) continue;
		const board = ctx.boards.find((b) => b.id === boardId);
		const updateBoard = boardMutations.find(
			(m): m is Extract<ChangeSetMutation, { op: 'update_board' }> => m.op === 'update_board'
		);
		const name = displayName(updateBoard?.name ?? board?.name);
		const noun = board?.kind === 'snippet' ? 'Snippet' : 'Board';
		boardGroups.push({
			kind: 'board',
			key: `board-${boardId}`,
			boardId,
			name,
			width: updateBoard?.width ?? board?.width ?? 1,
			height: updateBoard?.height ?? board?.height ?? 1,
			summary: `${noun} “${name}”`,
			buttons: previewButtonsOnBoard(projected, boardId),
			overlays: buildOverlays(boardMutations, descriptionCtx, boardId),
			changeLines: boardMutations.map((m) => describeScopedChange(m, descriptionCtx))
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
