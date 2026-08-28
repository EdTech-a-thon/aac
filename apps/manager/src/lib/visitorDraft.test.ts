import { describe, expect, it } from 'vitest';
import {
	clearVisitorDraft,
	readVisitorDraft,
	writeVisitorDraft,
	type DraftStorage,
	type VisitorDraftState
} from './visitorDraft';

function fakeStorage(seed: Record<string, string> = {}) {
	const map = new Map(Object.entries(seed));
	const storage: DraftStorage = {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value),
		removeItem: (key) => void map.delete(key)
	};
	return { storage, map };
}

function state(boardName = 'Home'): VisitorDraftState {
	return {
		boards: [
			{
				id: 'home',
				vocabulary_id: 'vocab',
				name: boardName,
				displayName: boardName,
				width: 4,
				height: 3,
				kind: 'board',
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z'
			}
		],
		buttonsByBoardId: { home: [] },
		paletteColors: [],
		snippetInclusions: []
	};
}

describe('a Visitor’s draft', () => {
	it('comes back when the same Share Link is opened again', () => {
		const { storage } = fakeStorage();

		writeVisitorDraft(storage, 'token-a', state('Edited'));
		const restored = readVisitorDraft(storage, 'token-a');

		expect(restored?.state.boards[0].name).toBe('Edited');
	});

	it('is nothing at all before the Visitor has changed anything', () => {
		const { storage } = fakeStorage();

		expect(readVisitorDraft(storage, 'token-a')).toBeNull();
	});

	it('belongs to one Share Link, so another link shows its own work', () => {
		const { storage } = fakeStorage();

		writeVisitorDraft(storage, 'token-a', state('From A'));
		writeVisitorDraft(storage, 'token-b', state('From B'));

		expect(readVisitorDraft(storage, 'token-a')?.state.boards[0].name).toBe('From A');
		expect(readVisitorDraft(storage, 'token-b')?.state.boards[0].name).toBe('From B');
	});

	it('is gone once discarded, leaving the other links alone', () => {
		const { storage } = fakeStorage();
		writeVisitorDraft(storage, 'token-a', state());
		writeVisitorDraft(storage, 'token-b', state());

		clearVisitorDraft(storage, 'token-a');

		expect(readVisitorDraft(storage, 'token-a')).toBeNull();
		expect(readVisitorDraft(storage, 'token-b')).not.toBeNull();
	});

	it('records when it was saved, so the Visitor can be told', () => {
		const { storage } = fakeStorage();

		const written = writeVisitorDraft(storage, 'token-a', state());

		expect(Number.isNaN(Date.parse(written.savedAt))).toBe(false);
		expect(readVisitorDraft(storage, 'token-a')?.savedAt).toBe(written.savedAt);
	});

	it('treats unreadable stored content as no draft rather than failing to open', () => {
		const { storage } = fakeStorage();
		writeVisitorDraft(storage, 'token-a', state());
		storage.setItem('aac-visitor-draft:token-a', 'not json');

		expect(readVisitorDraft(storage, 'token-a')).toBeNull();
	});

	it('ignores stored content that is missing the parts a canvas needs', () => {
		const { storage } = fakeStorage({
			'aac-visitor-draft:token-a': JSON.stringify({ savedAt: 'now', state: { boards: 'no' } })
		});

		expect(readVisitorDraft(storage, 'token-a')).toBeNull();
	});

	it('survives a browser that refuses to store anything', () => {
		const refusing: DraftStorage = {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			},
			removeItem: () => {
				throw new Error('denied');
			}
		};

		expect(() => writeVisitorDraft(refusing, 'token-a', state())).not.toThrow();
		expect(readVisitorDraft(refusing, 'token-a')).toBeNull();
		expect(() => clearVisitorDraft(refusing, 'token-a')).not.toThrow();
	});
});
