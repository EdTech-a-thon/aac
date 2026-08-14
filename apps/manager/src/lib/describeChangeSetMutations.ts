import { BUTTON_ACTION_KIND_OPTIONS, type ButtonAction } from './buttonAction';
import { cellRef, columnLetter, rowNumber } from './boardCellRef';
import type { ChangeSetMutation } from './changeSetMutations';

export type MutationLookupContext = {
	boards: { id: string; name: string; width: number; height: number; kind?: 'board' | 'snippet' }[];
	buttons: {
		id: string;
		board_id: string;
		label: string;
		row_index: number;
		col_index: number;
	}[];
	paletteColors: { id: string; name: string; hex: string }[];
	snippetInclusions?: {
		id: string;
		host_id: string;
		snippet_id: string;
		origin_row: number;
		origin_col: number;
	}[];
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

function boardName(ctx: MutationLookupContext, boardId: string, fallbackName?: string) {
	const board = ctx.boards.find((b) => b.id === boardId);
	if (board) return `“${displayName(board.name)}”`;
	if (fallbackName !== undefined) return `“${displayName(fallbackName)}”`;
	return 'an unknown board';
}

function boardsAfterMutations(
	boards: MutationLookupContext['boards'],
	mutations: ChangeSetMutation[]
): MutationLookupContext['boards'] {
	const byId = new Map(boards.map((board) => [board.id, { ...board }]));
	for (const mutation of mutations) {
		if (mutation.op === 'create_board') {
			byId.set(mutation.id, {
				id: mutation.id,
				name: mutation.name,
				width: mutation.width,
				height: mutation.height,
				kind: mutation.kind === 'snippet' ? 'snippet' : 'board'
			});
		} else if (mutation.op === 'update_board') {
			const existing = byId.get(mutation.id);
			if (!existing) continue;
			byId.set(mutation.id, {
				...existing,
				width: mutation.width ?? existing.width,
				height: mutation.height ?? existing.height
			});
		}
	}
	return [...byId.values()];
}

/** Resolve Boards/Snippets created in the same Change Set, plus resized dimensions. */
export function lookupWithChangeSetBoards<T extends MutationLookupContext>(
	ctx: T,
	mutations: ChangeSetMutation[]
): T {
	return { ...ctx, boards: boardsAfterMutations(ctx.boards, mutations) };
}

function findButton(ctx: MutationLookupContext, buttonId: string) {
	return ctx.buttons.find((b) => b.id === buttonId);
}

function paletteName(ctx: MutationLookupContext, colorId: string, fallbackName?: string) {
	const color = ctx.paletteColors.find((c) => c.id === colorId);
	if (color) {
		const name = color.name.trim();
		return name ? `“${name}” (${color.hex})` : `unnamed color (${color.hex})`;
	}
	if (fallbackName !== undefined) {
		const name = fallbackName.trim();
		return name ? `“${name}”` : 'an unnamed Palette Color';
	}
	return 'an unknown Palette Color';
}

function actionSummary(action: ButtonAction | null | undefined, ctx: MutationLookupContext): string {
	if (!action) return 'no Action';
	const label =
		BUTTON_ACTION_KIND_OPTIONS.find((option) => option.kind === action.kind)?.label ?? action.kind;
	switch (action.kind) {
		case 'insert_phrase':
		case 'speak_immediately':
			return `${label} (“${action.phrase}”)`;
		case 'open_board':
			return `${label} (${boardName(ctx, action.board_id)})`;
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
	if (paletteColorId) return `Palette Color ${paletteName(ctx, paletteColorId)}`;
	if (backgroundColor) return `custom ${backgroundColor}`;
	return 'None';
}

/** Human-readable one-line summaries for Suggested / Applied Change Set mutations. */
export function describeChangeSetMutations(
	mutations: ChangeSetMutation[],
	ctx: MutationLookupContext
): string[] {
	const lookup = lookupWithChangeSetBoards(ctx, mutations);
	return mutations.map((mutation) => describeMutation(mutation, lookup));
}

function describeMutation(mutation: ChangeSetMutation, ctx: MutationLookupContext): string {
	switch (mutation.op) {
		case 'create_board':
			return `Create ${gridNoun(mutation.kind)} “${displayName(mutation.name)}” (${mutation.width}×${mutation.height})`;
		case 'update_board': {
			const parts: string[] = [];
			if (mutation.name !== undefined) parts.push(`rename to “${displayName(mutation.name)}”`);
			if (mutation.width !== undefined || mutation.height !== undefined) {
				const board = ctx.boards.find((b) => b.id === mutation.id);
				const width = mutation.width ?? board?.width;
				const height = mutation.height ?? board?.height;
				if (width !== undefined && height !== undefined) {
					parts.push(`resize to ${width}×${height}`);
				} else if (mutation.width !== undefined) {
					parts.push(`set width to ${mutation.width}`);
				} else if (mutation.height !== undefined) {
					parts.push(`set height to ${mutation.height}`);
				}
			}
			const detail = parts.length > 0 ? `: ${parts.join('; ')}` : '';
			const existing = ctx.boards.find((b) => b.id === mutation.id);
			return `Update ${gridNoun(existing?.kind)} ${boardName(ctx, mutation.id)}${detail}`;
		}
		case 'delete_board':
			return `Delete ${gridNoun(ctx.boards.find((b) => b.id === mutation.id)?.kind)} ${boardName(ctx, mutation.id)}`;
		case 'create_button': {
			const parts = [
				`Create ${buttonPhrase(mutation.label)} on ${boardName(ctx, mutation.board_id)} at ${cellRef(mutation.row_index, mutation.col_index)}`
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
			const existing = findButton(ctx, mutation.id);
			const phrase = existing ? buttonPhrase(existing.label) : 'button';
			const onBoard = existing
				? ` on ${boardName(ctx, existing.board_id)}`
				: '';
			const parts: string[] = [];
			if (mutation.board_id !== undefined) {
				parts.push(`move to board ${boardName(ctx, mutation.board_id)}`);
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
			return `Update ${phrase}${onBoard}${detail}`;
		}
		case 'delete_button': {
			const existing = findButton(ctx, mutation.id);
			if (!existing) return 'Delete button';
			return `Delete ${buttonPhrase(existing.label)} on ${boardName(ctx, existing.board_id)} at ${cellRef(existing.row_index, existing.col_index)}`;
		}
		case 'create_palette_color': {
			const name = mutation.name.trim();
			const named = name ? `“${name}”` : 'an unnamed color';
			return `Add Palette Color ${named} (${mutation.hex})`;
		}
		case 'update_palette_color': {
			const parts: string[] = [];
			if (mutation.hex !== undefined) parts.push(`hex → ${mutation.hex}`);
			if (mutation.name !== undefined) {
				parts.push(
					mutation.name.trim()
						? `rename to “${mutation.name.trim()}”`
						: 'clear name'
				);
			}
			if (mutation.description !== undefined) {
				parts.push(
					mutation.description.trim()
						? `update description`
						: 'clear description'
				);
			}
			if (mutation.position !== undefined) {
				parts.push(`move to position ${mutation.position + 1}`);
			}
			const detail = parts.length > 0 ? `: ${parts.join('; ')}` : '';
			return `Update Palette Color ${paletteName(ctx, mutation.id)}${detail}`;
		}
		case 'delete_palette_color':
			return `Delete Palette Color ${paletteName(ctx, mutation.id)}`;
		case 'create_snippet_inclusion':
			return `Create Snippet Inclusion of ${boardName(ctx, mutation.snippet_id)} on ${boardName(ctx, mutation.host_id)} at ${cellRef(mutation.origin_row, mutation.origin_col)}`;
		case 'update_snippet_inclusion': {
			const existing = (ctx.snippetInclusions ?? []).find((inc) => inc.id === mutation.id);
			const snippetId = existing?.snippet_id;
			const hostId = existing?.host_id;
			const parts: string[] = [];
			if (mutation.origin_row !== undefined || mutation.origin_col !== undefined) {
				const row = mutation.origin_row ?? existing?.origin_row;
				const col = mutation.origin_col ?? existing?.origin_col;
				if (row !== undefined && col !== undefined) {
					parts.push(`move to ${cellRef(row, col)}`);
				}
			}
			const detail = parts.length > 0 ? `: ${parts.join('; ')}` : '';
			return `Update Snippet Inclusion of ${snippetId ? boardName(ctx, snippetId) : 'a Snippet'} on ${hostId ? boardName(ctx, hostId) : 'a Board'}${detail}`;
		}
		case 'delete_snippet_inclusion': {
			const existing = (ctx.snippetInclusions ?? []).find((inc) => inc.id === mutation.id);
			if (!existing) return 'Delete Snippet Inclusion';
			return `Delete Snippet Inclusion of ${boardName(ctx, existing.snippet_id)} on ${boardName(ctx, existing.host_id)}`;
		}
	}
}

/** Narrow unknown API mutation payloads to ChangeSetMutation when `op` is recognized. */
export function asChangeSetMutations(value: unknown): ChangeSetMutation[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isChangeSetMutation);
}

/** Normalize Suggested Change Set rows from the API (mutations may be loosely typed JSON). */
export function normalizeSuggestedChangeSets<
	T extends { status?: string; mutations: unknown }
>(
	changeSets: T[]
): Array<Omit<T, 'status' | 'mutations'> & { status: 'suggested'; mutations: ChangeSetMutation[] }> {
	return changeSets.map((cs) => ({
		...cs,
		status: 'suggested' as const,
		mutations: asChangeSetMutations(cs.mutations)
	}));
}

function isChangeSetMutation(value: unknown): value is ChangeSetMutation {
	if (!value || typeof value !== 'object') return false;
	const op = (value as { op?: unknown }).op;
	return (
		op === 'create_board' ||
		op === 'update_board' ||
		op === 'delete_board' ||
		op === 'create_button' ||
		op === 'update_button' ||
		op === 'delete_button' ||
		op === 'create_palette_color' ||
		op === 'update_palette_color' ||
		op === 'delete_palette_color' ||
		op === 'create_snippet_inclusion' ||
		op === 'update_snippet_inclusion' ||
		op === 'delete_snippet_inclusion'
	);
}
