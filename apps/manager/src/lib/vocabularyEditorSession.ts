import {
	diffBoardButtonMutations,
	diffPaletteMutations,
	type BoardSnapshot,
	type ButtonSnapshot,
	type ChangeSetMutation,
	type PaletteColorSnapshot
} from './changeSetMutations';
import type { Board, BoardButton, PaletteColor } from './types';

export type SuggestedChangeSet = {
	id: string;
	status: 'suggested';
	mutations: unknown[];
	created_at: string;
	author_id: string | null;
};

export type VocabularyEditorSession = {
	vocabularyId: string;
	boards: Board[];
	buttonsByBoardId: Record<string, BoardButton[]>;
	baseBoards: Board[];
	baseButtonsByBoardId: Record<string, BoardButton[]>;
	paletteColors: PaletteColor[];
	basePaletteColors: PaletteColor[];
	paletteHydrated: boolean;
	selectedBoardId: string | null;
	suggestedChangeSets: SuggestedChangeSet[];
	hydrated: boolean;
};

const sessions = new Map<string, VocabularyEditorSession>();
const revisionListeners = new Set<() => void>();

function cloneBoards(value: Board[]): Board[] {
	return structuredClone(value);
}

function cloneButtonsByBoardId(
	value: Record<string, BoardButton[]>
): Record<string, BoardButton[]> {
	return structuredClone(value);
}

function toBoardSnapshot(board: Board): BoardSnapshot {
	return {
		id: board.id,
		name: board.name,
		width: board.width,
		height: board.height
	};
}

function toButtonSnapshot(button: BoardButton): ButtonSnapshot {
	return {
		id: button.id,
		board_id: button.board_id,
		row_index: button.row_index,
		col_index: button.col_index,
		label: button.label,
		background_color: button.background_color,
		palette_color_id: button.palette_color_id,
		action: button.action ?? null
	};
}

function allButtonsFromMap(map: Record<string, BoardButton[]>) {
	return Object.values(map).flat();
}

function clonePaletteColors(value: PaletteColor[]): PaletteColor[] {
	return structuredClone(value);
}

function toPaletteSnapshot(color: PaletteColor): PaletteColorSnapshot {
	return {
		id: color.id,
		hex: color.hex,
		name: color.name,
		description: color.description,
		position: color.position
	};
}

export function __resetVocabularyEditorSessionsForTests() {
	sessions.clear();
}

/** Notify UI that a Vocabulary editor session's staged data changed. */
export function bumpEditorRevision() {
	for (const listener of revisionListeners) listener();
}

export function subscribeEditorRevision(listener: () => void) {
	revisionListeners.add(listener);
	return () => {
		revisionListeners.delete(listener);
	};
}

export function persistEditorSession(
	session: VocabularyEditorSession,
	patch: Partial<
		Pick<
			VocabularyEditorSession,
			| 'boards'
			| 'buttonsByBoardId'
			| 'baseBoards'
			| 'baseButtonsByBoardId'
			| 'paletteColors'
			| 'basePaletteColors'
			| 'paletteHydrated'
			| 'selectedBoardId'
			| 'suggestedChangeSets'
			| 'hydrated'
		>
	>
) {
	if (patch.boards) session.boards = cloneBoards(patch.boards);
	if (patch.buttonsByBoardId) {
		session.buttonsByBoardId = cloneButtonsByBoardId(patch.buttonsByBoardId);
	}
	if (patch.baseBoards) session.baseBoards = cloneBoards(patch.baseBoards);
	if (patch.baseButtonsByBoardId) {
		session.baseButtonsByBoardId = cloneButtonsByBoardId(patch.baseButtonsByBoardId);
	}
	if (patch.paletteColors) session.paletteColors = clonePaletteColors(patch.paletteColors);
	if (patch.basePaletteColors) {
		session.basePaletteColors = clonePaletteColors(patch.basePaletteColors);
	}
	if (patch.paletteHydrated !== undefined) session.paletteHydrated = patch.paletteHydrated;
	if (patch.selectedBoardId !== undefined) session.selectedBoardId = patch.selectedBoardId;
	if (patch.suggestedChangeSets) {
		session.suggestedChangeSets = structuredClone(patch.suggestedChangeSets);
	}
	if (patch.hydrated !== undefined) session.hydrated = patch.hydrated;
	bumpEditorRevision();
}

export function getVocabularyEditorSession(vocabularyId: string): VocabularyEditorSession {
	let session = sessions.get(vocabularyId);
	if (!session) {
		session = {
			vocabularyId,
			boards: [],
			buttonsByBoardId: {},
			baseBoards: [],
			baseButtonsByBoardId: {},
			paletteColors: [],
			basePaletteColors: [],
			paletteHydrated: false,
			selectedBoardId: null,
			suggestedChangeSets: [],
			hydrated: false
		};
		sessions.set(vocabularyId, session);
	}
	return session;
}

export function replaceEditorLiveFromServer(
	session: VocabularyEditorSession,
	boards: Board[],
	buttonsByBoardId: Record<string, BoardButton[]>,
	paletteColors?: PaletteColor[]
) {
	session.boards = cloneBoards(boards);
	session.buttonsByBoardId = cloneButtonsByBoardId(buttonsByBoardId);
	session.baseBoards = cloneBoards(boards);
	session.baseButtonsByBoardId = cloneButtonsByBoardId(buttonsByBoardId);
	if (paletteColors) {
		session.paletteColors = clonePaletteColors(paletteColors);
		session.basePaletteColors = clonePaletteColors(paletteColors);
		session.paletteHydrated = true;
	}
	if (
		!session.selectedBoardId ||
		!boards.some((board) => board.id === session.selectedBoardId)
	) {
		session.selectedBoardId = boards[0]?.id ?? null;
	}
	session.hydrated = true;
	bumpEditorRevision();
}

function boardDisplayName(name: string) {
	const trimmed = name.trim();
	return trimmed ? trimmed : 'Untitled';
}

/** Replay Change Set mutations onto the working copy only (not the live base). */
function applyMutationsToWorkingCopy(
	session: VocabularyEditorSession,
	mutations: ChangeSetMutation[]
) {
	const now = new Date().toISOString();

	for (const mutation of mutations) {
		switch (mutation.op) {
			case 'create_board': {
				session.boards = [
					...session.boards,
					{
						id: mutation.id,
						vocabulary_id: session.vocabularyId,
						name: mutation.name,
						displayName: boardDisplayName(mutation.name),
						width: mutation.width,
						height: mutation.height,
						created_at: now,
						updated_at: now
					}
				];
				session.buttonsByBoardId = {
					...session.buttonsByBoardId,
					[mutation.id]: []
				};
				break;
			}
			case 'update_board': {
				session.boards = session.boards.map((board) => {
					if (board.id !== mutation.id) return board;
					const name = mutation.name !== undefined ? mutation.name : board.name;
					return {
						...board,
						name,
						displayName: boardDisplayName(name),
						width: mutation.width !== undefined ? mutation.width : board.width,
						height: mutation.height !== undefined ? mutation.height : board.height,
						updated_at: now
					};
				});
				break;
			}
			case 'delete_board': {
				session.boards = session.boards.filter((board) => board.id !== mutation.id);
				const { [mutation.id]: _removed, ...rest } = session.buttonsByBoardId;
				session.buttonsByBoardId = rest;
				for (const [boardId, buttons] of Object.entries(session.buttonsByBoardId)) {
					session.buttonsByBoardId[boardId] = buttons.map((button) => {
						if (
							button.action?.kind === 'open_board' &&
							button.action.board_id === mutation.id
						) {
							return { ...button, action: null, updated_at: now };
						}
						return button;
					});
				}
				break;
			}
			case 'create_button': {
				const button: BoardButton = {
					id: mutation.id,
					board_id: mutation.board_id,
					row_index: mutation.row_index,
					col_index: mutation.col_index,
					label: mutation.label,
					background_color:
						mutation.background_color !== undefined ? mutation.background_color : null,
					palette_color_id:
						mutation.palette_color_id !== undefined ? mutation.palette_color_id : null,
					action: mutation.action !== undefined ? mutation.action : null,
					created_at: now,
					updated_at: now
				};
				const existing = session.buttonsByBoardId[mutation.board_id] ?? [];
				session.buttonsByBoardId = {
					...session.buttonsByBoardId,
					[mutation.board_id]: [...existing, button]
				};
				break;
			}
			case 'update_button': {
				let movedFrom: string | null = null;
				let updated: BoardButton | null = null;
				const nextMap: Record<string, BoardButton[]> = {};
				for (const [boardId, buttons] of Object.entries(session.buttonsByBoardId)) {
					nextMap[boardId] = [];
					for (const button of buttons) {
						if (button.id !== mutation.id) {
							nextMap[boardId].push(button);
							continue;
						}
						updated = {
							...button,
							board_id:
								mutation.board_id !== undefined ? mutation.board_id : button.board_id,
							row_index:
								mutation.row_index !== undefined ? mutation.row_index : button.row_index,
							col_index:
								mutation.col_index !== undefined ? mutation.col_index : button.col_index,
							label: mutation.label !== undefined ? mutation.label : button.label,
							background_color:
								mutation.background_color !== undefined
									? mutation.background_color
									: button.background_color,
							palette_color_id:
								mutation.palette_color_id !== undefined
									? mutation.palette_color_id
									: button.palette_color_id,
							action: mutation.action !== undefined ? mutation.action : button.action,
							updated_at: now
						};
						if (updated.board_id !== boardId) movedFrom = boardId;
						else nextMap[boardId].push(updated);
					}
				}
				if (updated && movedFrom !== null) {
					const dest = updated.board_id;
					nextMap[dest] = [...(nextMap[dest] ?? []), updated];
				}
				if (updated) session.buttonsByBoardId = nextMap;
				break;
			}
			case 'delete_button': {
				const nextMap: Record<string, BoardButton[]> = {};
				for (const [boardId, buttons] of Object.entries(session.buttonsByBoardId)) {
					nextMap[boardId] = buttons.filter((button) => button.id !== mutation.id);
				}
				session.buttonsByBoardId = nextMap;
				break;
			}
			case 'create_palette_color': {
				session.paletteColors = [
					...session.paletteColors,
					{
						id: mutation.id,
						vocabulary_id: session.vocabularyId,
						hex: mutation.hex,
						name: mutation.name,
						description: mutation.description,
						position: mutation.position,
						created_at: now,
						updated_at: now
					}
				];
				break;
			}
			case 'update_palette_color': {
				session.paletteColors = session.paletteColors.map((color) => {
					if (color.id !== mutation.id) return color;
					return {
						...color,
						hex: mutation.hex !== undefined ? mutation.hex : color.hex,
						name: mutation.name !== undefined ? mutation.name : color.name,
						description:
							mutation.description !== undefined
								? mutation.description
								: color.description,
						position: mutation.position !== undefined ? mutation.position : color.position,
						updated_at: now
					};
				});
				break;
			}
			case 'delete_palette_color': {
				const deleted = session.paletteColors.find((color) => color.id === mutation.id);
				session.paletteColors = session.paletteColors.filter(
					(color) => color.id !== mutation.id
				);
				if (deleted) {
					const nextMap: Record<string, BoardButton[]> = {};
					for (const [boardId, buttons] of Object.entries(session.buttonsByBoardId)) {
						nextMap[boardId] = buttons.map((button) => {
							if (button.palette_color_id !== mutation.id) return button;
							return {
								...button,
								palette_color_id: null,
								background_color: deleted.hex,
								updated_at: now
							};
						});
					}
					session.buttonsByBoardId = nextMap;
				}
				break;
			}
		}
	}

	if (
		!session.selectedBoardId ||
		!session.boards.some((board) => board.id === session.selectedBoardId)
	) {
		session.selectedBoardId = session.boards[0]?.id ?? null;
	}
}

/**
 * Advance the live tip from the server while preserving staged local edits.
 * Captures pending mutations, replaces base+working with the new tip, then
 * replays those mutations onto the working copy.
 */
export function rebaseEditorOntoLiveFromServer(
	session: VocabularyEditorSession,
	boards: Board[],
	buttonsByBoardId: Record<string, BoardButton[]>,
	paletteColors?: PaletteColor[]
) {
	const pending = pendingEditorMutations(session);
	replaceEditorLiveFromServer(session, boards, buttonsByBoardId, paletteColors);
	if (pending.length > 0) {
		applyMutationsToWorkingCopy(session, pending);
		bumpEditorRevision();
	}
}

export function replaceEditorPaletteFromServer(
	session: VocabularyEditorSession,
	paletteColors: PaletteColor[]
) {
	session.paletteColors = clonePaletteColors(paletteColors);
	session.basePaletteColors = clonePaletteColors(paletteColors);
	session.paletteHydrated = true;
	bumpEditorRevision();
}

export function acceptEditorBase(session: VocabularyEditorSession) {
	session.baseBoards = cloneBoards(session.boards);
	session.baseButtonsByBoardId = cloneButtonsByBoardId(session.buttonsByBoardId);
	session.basePaletteColors = clonePaletteColors(session.paletteColors);
	bumpEditorRevision();
}

export function discardEditorChanges(session: VocabularyEditorSession) {
	session.boards = cloneBoards(session.baseBoards);
	session.buttonsByBoardId = cloneButtonsByBoardId(session.baseButtonsByBoardId);
	session.paletteColors = clonePaletteColors(session.basePaletteColors);
	if (
		!session.selectedBoardId ||
		!session.boards.some((board) => board.id === session.selectedBoardId)
	) {
		session.selectedBoardId = session.boards[0]?.id ?? null;
	}
	bumpEditorRevision();
}

export function pendingBoardButtonMutations(
	session: VocabularyEditorSession
): ChangeSetMutation[] {
	return diffBoardButtonMutations(
		session.baseBoards.map(toBoardSnapshot),
		allButtonsFromMap(session.baseButtonsByBoardId).map(toButtonSnapshot),
		session.boards.map(toBoardSnapshot),
		allButtonsFromMap(session.buttonsByBoardId).map(toButtonSnapshot)
	);
}

export function pendingPaletteMutations(session: VocabularyEditorSession): ChangeSetMutation[] {
	return diffPaletteMutations(
		session.basePaletteColors.map(toPaletteSnapshot),
		session.paletteColors.map(toPaletteSnapshot)
	);
}

export function pendingEditorMutations(session: VocabularyEditorSession): ChangeSetMutation[] {
	return [...pendingBoardButtonMutations(session), ...pendingPaletteMutations(session)];
}

export function isEditorDirty(session: VocabularyEditorSession) {
	return pendingEditorMutations(session).length > 0;
}
