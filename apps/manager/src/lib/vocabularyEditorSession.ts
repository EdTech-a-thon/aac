import {
	diffBoardButtonMutations,
	diffPaletteMutations,
	diffSnippetInclusionMutations,
	type BoardSnapshot,
	type ButtonSnapshot,
	type ChangeSetMutation,
	type PaletteColorSnapshot
} from './changeSetMutations';
import { projectVocabulary } from './projectVocabulary';
import type { Board, BoardButton, PaletteColor, SnippetInclusion } from './types';

export type SuggestedChangeSet = {
	id: string;
	status: 'suggested';
	mutations: ChangeSetMutation[];
	created_at: string;
	author_id: string | null;
	author_name?: string | null;
	author_email?: string | null;
};

export type VocabularyEditorSession = {
	vocabularyId: string;
	boards: Board[];
	buttonsByBoardId: Record<string, BoardButton[]>;
	baseBoards: Board[];
	baseButtonsByBoardId: Record<string, BoardButton[]>;
	paletteColors: PaletteColor[];
	basePaletteColors: PaletteColor[];
	snippetInclusions: SnippetInclusion[];
	baseSnippetInclusions: SnippetInclusion[];
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
		height: board.height,
		kind: board.kind
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
		action: button.action ?? null,
		symbol_digest: button.symbol_digest ?? null
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
			| 'snippetInclusions'
			| 'baseSnippetInclusions'
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
	if (patch.snippetInclusions) {
		session.snippetInclusions = structuredClone(patch.snippetInclusions);
	}
	if (patch.baseSnippetInclusions) {
		session.baseSnippetInclusions = structuredClone(patch.baseSnippetInclusions);
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
			snippetInclusions: [],
			baseSnippetInclusions: [],
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
	paletteColors?: PaletteColor[],
	snippetInclusions: SnippetInclusion[] = []
) {
	session.boards = cloneBoards(boards);
	session.buttonsByBoardId = cloneButtonsByBoardId(buttonsByBoardId);
	session.baseBoards = cloneBoards(boards);
	session.baseButtonsByBoardId = cloneButtonsByBoardId(buttonsByBoardId);
	session.snippetInclusions = structuredClone(snippetInclusions);
	session.baseSnippetInclusions = structuredClone(snippetInclusions);
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

function groupButtonsByBoard(
	boards: Board[],
	buttons: BoardButton[]
): Record<string, BoardButton[]> {
	const map: Record<string, BoardButton[]> = {};
	for (const board of boards) {
		map[board.id] = [];
	}
	for (const button of buttons) {
		const list = map[button.board_id] ?? [];
		list.push(button);
		map[button.board_id] = list;
	}
	return map;
}

/** Project pending mutations onto the working copy only (not the live base). */
function applyProjectedVocabularyToWorkingCopy(
	session: VocabularyEditorSession,
	mutations: ChangeSetMutation[]
) {
	const projected = projectVocabulary(
		{
			vocabularyId: session.vocabularyId,
			boards: session.boards,
			buttons: allButtonsFromMap(session.buttonsByBoardId),
			paletteColors: session.paletteColors,
			snippetInclusions: session.snippetInclusions
		},
		mutations
	);
	session.boards = projected.boards;
	session.buttonsByBoardId = groupButtonsByBoard(projected.boards, projected.buttons);
	session.paletteColors = projected.paletteColors;
	session.snippetInclusions = projected.snippetInclusions;
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
 * projects those mutations onto the working copy.
 */
export function rebaseEditorOntoLiveFromServer(
	session: VocabularyEditorSession,
	boards: Board[],
	buttonsByBoardId: Record<string, BoardButton[]>,
	paletteColors?: PaletteColor[],
	snippetInclusions: SnippetInclusion[] = []
) {
	const pending = pendingEditorMutations(session);
	replaceEditorLiveFromServer(
		session,
		boards,
		buttonsByBoardId,
		paletteColors,
		snippetInclusions
	);
	if (pending.length > 0) {
		applyProjectedVocabularyToWorkingCopy(session, pending);
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
	session.baseSnippetInclusions = structuredClone(session.snippetInclusions);
	bumpEditorRevision();
}

export function discardEditorChanges(session: VocabularyEditorSession) {
	session.boards = cloneBoards(session.baseBoards);
	session.buttonsByBoardId = cloneButtonsByBoardId(session.baseButtonsByBoardId);
	session.paletteColors = clonePaletteColors(session.basePaletteColors);
	session.snippetInclusions = structuredClone(session.baseSnippetInclusions);
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
	return [
		...pendingBoardButtonMutations(session),
		...pendingPaletteMutations(session),
		...diffSnippetInclusionMutations(
			session.baseSnippetInclusions.map((inc) => ({
				id: inc.id,
				host_id: inc.host_id,
				snippet_id: inc.snippet_id,
				origin_row: inc.origin_row,
				origin_col: inc.origin_col
			})),
			session.snippetInclusions.map((inc) => ({
				id: inc.id,
				host_id: inc.host_id,
				snippet_id: inc.snippet_id,
				origin_row: inc.origin_row,
				origin_col: inc.origin_col
			})),
			new Set(session.boards.map((board) => board.id))
		)
	];
}

export function isEditorDirty(session: VocabularyEditorSession) {
	return pendingEditorMutations(session).length > 0;
}
