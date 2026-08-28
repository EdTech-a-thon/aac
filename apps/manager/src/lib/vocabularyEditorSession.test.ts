import { describe, expect, it, beforeEach } from 'vitest';
import {
	__resetVocabularyEditorSessionsForTests,
	acceptEditorBase,
	discardEditorChanges,
	getVocabularyEditorSession,
	pendingBoardButtonMutations,
	rebaseEditorOntoLiveFromServer,
	replaceEditorLiveFromServer,
	visibleVocabularySnapshot
} from './vocabularyEditorSession';

const board = {
	id: 'board-1',
	vocabulary_id: 'vocab-1',
	name: 'Home',
	displayName: 'Home',
	width: 2,
	height: 2,
	kind: 'board' as const,
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z'
};

const board2 = {
	id: 'board-2',
	vocabulary_id: 'vocab-1',
	name: 'Food',
	displayName: 'Food',
	width: 3,
	height: 3,
	kind: 'board' as const,
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z'
};

describe('vocabularyEditorSession', () => {
	beforeEach(() => {
		__resetVocabularyEditorSessionsForTests();
	});

	it('returns the same session for the same Vocabulary id', () => {
		const a = getVocabularyEditorSession('vocab-1');
		const b = getVocabularyEditorSession('vocab-1');
		expect(a).toBe(b);
		expect(getVocabularyEditorSession('vocab-2')).not.toBe(a);
	});

	it('keeps staged Board edits after replace-from-server is skipped once hydrated', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [] });
		expect(session.hydrated).toBe(true);

		session.boards = [{ ...board, name: 'Renamed', displayName: 'Renamed' }];
		expect(pendingBoardButtonMutations(session)).toEqual([
			expect.objectContaining({ op: 'update_board', id: 'board-1', name: 'Renamed' })
		]);

		const again = getVocabularyEditorSession('vocab-1');
		expect(again.boards[0]?.name).toBe('Renamed');
		expect(pendingBoardButtonMutations(again).length).toBe(1);
	});

	it('discard restores the live base and clears pending mutations', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [] });
		session.boards = [{ ...board, name: 'Renamed', displayName: 'Renamed' }];
		discardEditorChanges(session);
		expect(session.boards[0]?.name).toBe('Home');
		expect(pendingBoardButtonMutations(session)).toEqual([]);
	});

	it('acceptEditorBase treats current Boards/Buttons as the new live base', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [] });
		session.boards = [{ ...board, name: 'Renamed', displayName: 'Renamed' }];
		acceptEditorBase(session);
		expect(pendingBoardButtonMutations(session)).toEqual([]);
		expect(session.baseBoards[0]?.name).toBe('Renamed');
	});

	it('rebases staged Board edits onto a new live tip without discarding them', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [] });
		session.boards = [{ ...board, name: 'Renamed', displayName: 'Renamed' }];

		rebaseEditorOntoLiveFromServer(session, [board, board2], {
			'board-1': [],
			'board-2': []
		});

		expect(session.boards.map((b) => b.id).sort()).toEqual(['board-1', 'board-2']);
		expect(session.boards.find((b) => b.id === 'board-1')?.name).toBe('Renamed');
		expect(session.boards.find((b) => b.id === 'board-2')?.name).toBe('Food');
		expect(session.baseBoards.map((b) => b.name).sort()).toEqual(['Food', 'Home']);
		expect(pendingBoardButtonMutations(session)).toEqual([
			expect.objectContaining({ op: 'update_board', id: 'board-1', name: 'Renamed' })
		]);
	});

	it('advances a clean editor to the new live tip with no pending mutations', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [] });

		rebaseEditorOntoLiveFromServer(session, [board, board2], {
			'board-1': [],
			'board-2': []
		});

		expect(session.boards.map((b) => b.name).sort()).toEqual(['Food', 'Home']);
		expect(pendingBoardButtonMutations(session)).toEqual([]);
	});
});

describe('vocabularyEditorSession Symbols', () => {
	const DIGEST = 'f'.repeat(64);

	const button = {
		id: 'btn-1',
		board_id: 'board-1',
		row_index: 0,
		col_index: 0,
		label: 'drink',
		background_color: null,
		palette_color_id: null,
		action: null,
		symbol_digest: null,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z'
	};

	beforeEach(() => {
		__resetVocabularyEditorSessionsForTests();
	});

	function hydrated() {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [button] });
		return session;
	}

	it('stages setting a Symbol as a pending mutation', () => {
		const session = hydrated();
		session.buttonsByBoardId['board-1'] = [{ ...button, symbol_digest: DIGEST }];
		expect(pendingBoardButtonMutations(session)).toEqual([
			expect.objectContaining({ op: 'update_button', id: 'btn-1', symbol_digest: DIGEST })
		]);
	});

	it('stages clearing a Symbol', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], {
			'board-1': [{ ...button, symbol_digest: DIGEST }]
		});
		session.buttonsByBoardId['board-1'] = [{ ...button, symbol_digest: null }];
		expect(pendingBoardButtonMutations(session)).toEqual([
			expect.objectContaining({ op: 'update_button', id: 'btn-1', symbol_digest: null })
		]);
	});

	it('has no pending mutation when the Symbol is unchanged', () => {
		const session = hydrated();
		expect(pendingBoardButtonMutations(session)).toEqual([]);
	});

	it('reverts a staged Symbol when changes are discarded', () => {
		const session = hydrated();
		session.buttonsByBoardId['board-1'] = [{ ...button, symbol_digest: DIGEST }];
		discardEditorChanges(session);
		expect(session.buttonsByBoardId['board-1'][0].symbol_digest).toBeNull();
		expect(pendingBoardButtonMutations(session)).toEqual([]);
	});

	it('keeps a staged Symbol across a rebase onto new live server state', () => {
		const session = hydrated();
		session.buttonsByBoardId['board-1'] = [{ ...button, symbol_digest: DIGEST }];
		rebaseEditorOntoLiveFromServer(session, [board], { 'board-1': [button] });
		expect(pendingBoardButtonMutations(session)).toEqual([
			expect.objectContaining({ op: 'update_button', id: 'btn-1', symbol_digest: DIGEST })
		]);
	});

	it('visibleVocabularySnapshot reports live state when nothing is staged', () => {
		const session = getVocabularyEditorSession('vocab-1');
		const button = {
			id: 'button-1',
			board_id: 'board-1',
			row_index: 0,
			col_index: 0,
			label: 'hello',
			background_color: null,
			palette_color_id: null,
			action: null,
			symbol_digest: null,
			created_at: '2026-01-01T00:00:00.000Z',
			updated_at: '2026-01-01T00:00:00.000Z'
		};
		replaceEditorLiveFromServer(session, [board], { 'board-1': [button] });

		const snapshot = visibleVocabularySnapshot(session);
		expect(snapshot.boards).toEqual([
			expect.objectContaining({ id: 'board-1', name: 'Home', width: 2, height: 2 })
		]);
		expect(snapshot.buttons).toEqual([expect.objectContaining({ id: 'button-1', label: 'hello' })]);
	});

	it('visibleVocabularySnapshot folds in staged edits without applying them', () => {
		const session = getVocabularyEditorSession('vocab-1');
		replaceEditorLiveFromServer(session, [board], { 'board-1': [] });

		// Stage a rename and a brand new Board, the way the editor does.
		session.boards = [
			{ ...board, name: 'Renamed', displayName: 'Renamed' },
			{ ...board2, id: 'board-staged', name: 'Staged', displayName: 'Staged' }
		];

		const snapshot = visibleVocabularySnapshot(session);
		expect(snapshot.boards.map((entry) => entry.name)).toEqual(['Renamed', 'Staged']);
		// The staged edits are still staged — the snapshot did not consume them.
		expect(pendingBoardButtonMutations(session).length).toBeGreaterThan(0);
	});
});
