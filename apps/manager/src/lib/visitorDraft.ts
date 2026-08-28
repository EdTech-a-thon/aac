import type { Board, BoardButton, PaletteColor, SnippetInclusion } from '$lib/types';

/**
 * What a Visitor has changed about what they were sent. Their edits live only
 * in their own browser and never reach the source Vocabulary, so this is the
 * whole of the record. See ADR 0011.
 */
export type VisitorDraftState = {
	boards: Board[];
	buttonsByBoardId: Record<string, BoardButton[]>;
	paletteColors: PaletteColor[];
	snippetInclusions: SnippetInclusion[];
};

export type VisitorDraft = {
	savedAt: string;
	state: VisitorDraftState;
};

/** Only the parts of Storage this needs, so it can be tested without a browser. */
export type DraftStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
};

/** A draft belongs to one Share Link, never to a Vocabulary or a device. */
export function draftKey(token: string) {
	return `aac-visitor-draft:${token}`;
}

function looksLikeDraftState(value: unknown): value is VisitorDraftState {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		Array.isArray(candidate.boards) &&
		Array.isArray(candidate.paletteColors) &&
		Array.isArray(candidate.snippetInclusions) &&
		typeof candidate.buttonsByBoardId === 'object' &&
		candidate.buttonsByBoardId !== null
	);
}

/**
 * A browser may refuse to store anything at all — private windows, blocked
 * site data. That costs the Visitor their draft, but must never stop them
 * opening the link.
 */
export function readVisitorDraft(storage: DraftStorage, token: string): VisitorDraft | null {
	try {
		const stored = storage.getItem(draftKey(token));
		if (!stored) return null;
		const parsed = JSON.parse(stored) as Partial<VisitorDraft>;
		if (typeof parsed.savedAt !== 'string' || !looksLikeDraftState(parsed.state)) {
			return null;
		}
		return { savedAt: parsed.savedAt, state: parsed.state };
	} catch {
		return null;
	}
}

export function writeVisitorDraft(
	storage: DraftStorage,
	token: string,
	state: VisitorDraftState
): VisitorDraft {
	const draft: VisitorDraft = { savedAt: new Date().toISOString(), state };
	try {
		storage.setItem(draftKey(token), JSON.stringify(draft));
	} catch {
		// Nothing to do — the Visitor keeps working, just without a safety net.
	}
	return draft;
}

export function clearVisitorDraft(storage: DraftStorage, token: string) {
	try {
		storage.removeItem(draftKey(token));
	} catch {
		// Already effectively gone.
	}
}

/** The browser's own storage, when there is one. */
export function browserDraftStorage(): DraftStorage | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage;
}
