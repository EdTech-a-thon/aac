import {
	diffBoardButtonMutations,
	type BoardSnapshot,
	type ButtonSnapshot,
	type ChangeSetMutation
} from './changeSetMutations';
import type { Board, BoardButton } from './types';

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
		action: button.action ?? null
	};
}

function allButtonsFromMap(map: Record<string, BoardButton[]>) {
	return Object.values(map).flat();
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
	buttonsByBoardId: Record<string, BoardButton[]>
) {
	session.boards = cloneBoards(boards);
	session.buttonsByBoardId = cloneButtonsByBoardId(buttonsByBoardId);
	session.baseBoards = cloneBoards(boards);
	session.baseButtonsByBoardId = cloneButtonsByBoardId(buttonsByBoardId);
	if (
		!session.selectedBoardId ||
		!boards.some((board) => board.id === session.selectedBoardId)
	) {
		session.selectedBoardId = boards[0]?.id ?? null;
	}
	session.hydrated = true;
	bumpEditorRevision();
}

export function acceptEditorBase(session: VocabularyEditorSession) {
	session.baseBoards = cloneBoards(session.boards);
	session.baseButtonsByBoardId = cloneButtonsByBoardId(session.buttonsByBoardId);
	bumpEditorRevision();
}

export function discardEditorChanges(session: VocabularyEditorSession) {
	session.boards = cloneBoards(session.baseBoards);
	session.buttonsByBoardId = cloneButtonsByBoardId(session.baseButtonsByBoardId);
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

export function isEditorDirty(session: VocabularyEditorSession) {
	return pendingBoardButtonMutations(session).length > 0;
}
