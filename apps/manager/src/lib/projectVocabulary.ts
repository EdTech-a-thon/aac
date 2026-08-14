import type { ChangeSetMutation } from './changeSetMutations';
import type { Board, BoardButton, PaletteColor, SnippetInclusion } from './types';

export type ProjectedVocabulary = {
	vocabularyId: string;
	boards: Board[];
	buttons: BoardButton[];
	paletteColors: PaletteColor[];
	snippetInclusions: SnippetInclusion[];
};

function boardDisplayName(name: string) {
	const trimmed = name.trim();
	return trimmed ? trimmed : 'Untitled';
}

function isSnippetId(projected: ProjectedVocabulary, id: string) {
	return projected.boards.some((board) => board.id === id && board.kind === 'snippet');
}

function persistableAction(
	projected: ProjectedVocabulary,
	action: BoardButton['action'] | undefined
): BoardButton['action'] {
	if (action === undefined) return null;
	if (action?.kind === 'open_board' && isSnippetId(projected, action.board_id)) {
		return null;
	}
	return action;
}

function applyButtonColorXor(
	target: BoardButton,
	mutation: { background_color?: string | null; palette_color_id?: string | null }
) {
	const hasPalette = mutation.palette_color_id !== undefined;
	const hasBg = mutation.background_color !== undefined;
	if (hasPalette && mutation.palette_color_id) {
		target.palette_color_id = mutation.palette_color_id;
		target.background_color = null;
		return;
	}
	if (hasPalette) {
		target.palette_color_id = null;
		if (hasBg) target.background_color = mutation.background_color ?? null;
		return;
	}
	if (hasBg) {
		target.palette_color_id = null;
		target.background_color = mutation.background_color ?? null;
	}
}

export function projectVocabulary(
	live: ProjectedVocabulary,
	mutations: ChangeSetMutation[]
): ProjectedVocabulary {
	const projected = structuredClone(live);
	const now = new Date().toISOString();

	for (const mutation of mutations) {
		if (mutation.op === 'create_board') {
			if (projected.boards.some((board) => board.id === mutation.id)) continue;
			projected.boards.push({
				id: mutation.id,
				vocabulary_id: projected.vocabularyId,
				name: mutation.name,
				displayName: boardDisplayName(mutation.name),
				width: mutation.width,
				height: mutation.height,
				kind: mutation.kind === 'snippet' ? 'snippet' : 'board',
				created_at: now,
				updated_at: now
			});
			continue;
		}

		if (mutation.op === 'update_board') {
			const existing = projected.boards.find((board) => board.id === mutation.id);
			if (!existing) continue;
			if (mutation.name !== undefined) {
				existing.name = mutation.name;
				existing.displayName = boardDisplayName(mutation.name);
			}
			if (mutation.width !== undefined) existing.width = mutation.width;
			if (mutation.height !== undefined) existing.height = mutation.height;
			existing.updated_at = now;
			continue;
		}

		if (mutation.op === 'delete_board') {
			projected.boards = projected.boards.filter((board) => board.id !== mutation.id);
			projected.buttons = projected.buttons.filter((btn) => btn.board_id !== mutation.id);
			projected.snippetInclusions = projected.snippetInclusions.filter(
				(inc) => inc.host_id !== mutation.id && inc.snippet_id !== mutation.id
			);
			for (const btn of projected.buttons) {
				if (btn.action?.kind === 'open_board' && btn.action.board_id === mutation.id) {
					btn.action = null;
					btn.updated_at = now;
				}
			}
			continue;
		}

		if (mutation.op === 'create_button') {
			if (!projected.boards.some((b) => b.id === mutation.board_id)) continue;
			if (projected.buttons.some((b) => b.id === mutation.id)) continue;
			const created: BoardButton = {
				id: mutation.id,
				board_id: mutation.board_id,
				row_index: mutation.row_index,
				col_index: mutation.col_index,
				label: mutation.label,
				palette_color_id: null,
				background_color: null,
				action: persistableAction(
					projected,
					mutation.action !== undefined ? mutation.action : null
				),
				created_at: now,
				updated_at: now
			};
			applyButtonColorXor(created, mutation);
			projected.buttons.push(created);
			continue;
		}

		if (mutation.op === 'update_button') {
			const existing = projected.buttons.find((btn) => btn.id === mutation.id);
			if (!existing) continue;
			if (
				mutation.board_id !== undefined &&
				!projected.boards.some((b) => b.id === mutation.board_id)
			) {
				continue;
			}
			if (mutation.board_id !== undefined) existing.board_id = mutation.board_id;
			if (mutation.row_index !== undefined) existing.row_index = mutation.row_index;
			if (mutation.col_index !== undefined) existing.col_index = mutation.col_index;
			if (mutation.label !== undefined) existing.label = mutation.label;
			if (mutation.action !== undefined) {
				existing.action = persistableAction(projected, mutation.action);
			}
			applyButtonColorXor(existing, mutation);
			existing.updated_at = now;
			continue;
		}

		if (mutation.op === 'delete_button') {
			projected.buttons = projected.buttons.filter((btn) => btn.id !== mutation.id);
			continue;
		}

		if (mutation.op === 'create_palette_color') {
			if (projected.paletteColors.some((c) => c.id === mutation.id)) continue;
			projected.paletteColors.push({
				id: mutation.id,
				vocabulary_id: projected.vocabularyId,
				hex: mutation.hex,
				name: mutation.name,
				description: mutation.description,
				position: mutation.position,
				created_at: now,
				updated_at: now
			});
			continue;
		}

		if (mutation.op === 'update_palette_color') {
			const existing = projected.paletteColors.find((c) => c.id === mutation.id);
			if (!existing) continue;
			if (mutation.hex !== undefined) existing.hex = mutation.hex;
			if (mutation.name !== undefined) existing.name = mutation.name;
			if (mutation.description !== undefined) existing.description = mutation.description;
			if (mutation.position !== undefined) existing.position = mutation.position;
			existing.updated_at = now;
			continue;
		}

		if (mutation.op === 'delete_palette_color') {
			const deleted = projected.paletteColors.find((c) => c.id === mutation.id);
			if (!deleted) continue;
			projected.paletteColors = projected.paletteColors.filter((c) => c.id !== mutation.id);
			for (const btn of projected.buttons) {
				if (btn.palette_color_id !== mutation.id) continue;
				btn.palette_color_id = null;
				btn.background_color = deleted.hex;
				btn.updated_at = now;
			}
			continue;
		}

		if (mutation.op === 'create_snippet_inclusion') {
			if (projected.snippetInclusions.some((inc) => inc.id === mutation.id)) continue;
			const host = projected.boards.find((b) => b.id === mutation.host_id);
			const snippet = projected.boards.find((b) => b.id === mutation.snippet_id);
			if (!host || !snippet || snippet.kind !== 'snippet') continue;
			projected.snippetInclusions.push({
				id: mutation.id,
				host_id: mutation.host_id,
				snippet_id: mutation.snippet_id,
				origin_row: mutation.origin_row,
				origin_col: mutation.origin_col,
				created_at: now,
				updated_at: now
			});
			continue;
		}

		if (mutation.op === 'update_snippet_inclusion') {
			const existing = projected.snippetInclusions.find((inc) => inc.id === mutation.id);
			if (!existing) continue;
			if (mutation.origin_row !== undefined) existing.origin_row = mutation.origin_row;
			if (mutation.origin_col !== undefined) existing.origin_col = mutation.origin_col;
			existing.updated_at = now;
			continue;
		}

		if (mutation.op === 'delete_snippet_inclusion') {
			projected.snippetInclusions = projected.snippetInclusions.filter(
				(inc) => inc.id !== mutation.id
			);
		}
	}

	return projected;
}
