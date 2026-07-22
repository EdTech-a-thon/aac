import { describe, expect, it, beforeEach } from 'vitest';
import {
	__resetVocabularyEditorSessionsForTests,
	acceptEditorBase,
	discardEditorChanges,
	getVocabularyEditorSession,
	pendingBoardButtonMutations,
	replaceEditorLiveFromServer
} from './vocabularyEditorSession';

const board = {
	id: 'board-1',
	vocabulary_id: 'vocab-1',
	name: 'Home',
	displayName: 'Home',
	width: 2,
	height: 2,
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
});
