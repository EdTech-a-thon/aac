import { apiFetch, uploadSymbol, type AuthState } from '$lib/auth';
import { normalizeSuggestedChangeSets } from '$lib/describeChangeSetMutations';
import {
	loadVocabularyContent,
	type VocabularyContent,
	type VocabularyReader
} from '$lib/vocabularyContent';
import type { SuggestedChangeSet } from '$lib/vocabularyEditorSession';
import type {
	Board,
	BoardButton,
	PaletteColor,
	ShareLink,
	SnippetInclusion,
	UnresolvedCopyAction,
	Vocabulary
} from '$lib/types';

export type BoardCopyRequest = {
	vocabularyId: string;
	boardId: string;
	destinationVocabularyId: string;
	name: string;
	snapshot: unknown;
};

/**
 * Where the canvas gets a Vocabulary, and what it is allowed to do with it.
 * A signed-in Manager reads through their own session and may write; a
 * Visitor following a Share Link will read through the link and may not.
 * The canvas is told whether it can write — it does not infer it from
 * whether it happens to be holding credentials.
 */
export type VocabularySource = {
	readonly canWrite: boolean;
	loadContent(vocabularyId: string): Promise<VocabularyContent>;
	loadSuggestedChangeSets(vocabularyId: string): Promise<SuggestedChangeSet[]>;
	listCopyDestinations(): Promise<Vocabulary[]>;
	copyBoard(request: BoardCopyRequest): Promise<{ boardId: string }>;
	uploadSymbol(file: Blob): Promise<{ digest: string }>;
	readBoardShareLink(vocabularyId: string, boardId: string): Promise<ShareLink | null>;
	createBoardShareLink(vocabularyId: string, boardId: string): Promise<ShareLink>;
	revokeBoardShareLink(vocabularyId: string, boardId: string): Promise<void>;
};

function managedReader(accessToken: string): VocabularyReader {
	return {
		boards: async (vocabularyId) =>
			(await apiFetch<{ boards: Board[] }>(`/vocabularies/${vocabularyId}/boards`, { accessToken }))
				.boards,
		paletteColors: async (vocabularyId) =>
			(
				await apiFetch<{ paletteColors: PaletteColor[] }>(
					`/vocabularies/${vocabularyId}/palette-colors`,
					{ accessToken }
				)
			).paletteColors,
		snippetInclusions: async (vocabularyId) =>
			(
				await apiFetch<{ snippetInclusions: SnippetInclusion[] }>(
					`/vocabularies/${vocabularyId}/snippet-inclusions`,
					{ accessToken }
				)
			).snippetInclusions,
		unresolvedCopyActions: async (vocabularyId) =>
			(
				await apiFetch<{ unresolvedCopyActions: UnresolvedCopyAction[] }>(
					`/vocabularies/${vocabularyId}/unresolved-copy-actions`,
					{ accessToken }
				)
			).unresolvedCopyActions,
		buttons: async (vocabularyId, boardId) =>
			(
				await apiFetch<{ buttons: BoardButton[] }>(
					`/vocabularies/${vocabularyId}/boards/${boardId}/buttons`,
					{ accessToken }
				)
			).buttons
	};
}

/** The Vocabulary as one of its Managers sees it, through their session. */
export function managedVocabularySource(auth: AuthState): VocabularySource {
	const accessToken = auth.session.access_token;
	const reader = managedReader(accessToken);
	return {
		canWrite: true,
		loadContent: (vocabularyId) => loadVocabularyContent(vocabularyId, reader),
		loadSuggestedChangeSets: async (vocabularyId) => {
			const data = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
				`/vocabularies/${vocabularyId}/change-sets?status=suggested`,
				{ accessToken }
			);
			return normalizeSuggestedChangeSets(data.changeSets);
		},
		listCopyDestinations: async () =>
			(await apiFetch<{ vocabularies: Vocabulary[] }>('/vocabularies', { accessToken }))
				.vocabularies,
		copyBoard: (request) =>
			apiFetch<{ boardId: string }>(
				`/vocabularies/${request.vocabularyId}/boards/${request.boardId}/copy`,
				{
					method: 'POST',
					accessToken,
					body: JSON.stringify({
						destinationVocabularyId: request.destinationVocabularyId,
						name: request.name,
						snapshot: request.snapshot
					})
				}
			),
		uploadSymbol: (file) => uploadSymbol(file, accessToken),
		readBoardShareLink: async (vocabularyId, boardId) =>
			(
				await apiFetch<{ shareLink: ShareLink | null }>(
					`/vocabularies/${vocabularyId}/boards/${boardId}/share-link`,
					{ accessToken }
				)
			).shareLink,
		createBoardShareLink: async (vocabularyId, boardId) =>
			(
				await apiFetch<{ shareLink: ShareLink }>(
					`/vocabularies/${vocabularyId}/boards/${boardId}/share-link`,
					{ method: 'POST', accessToken }
				)
			).shareLink,
		revokeBoardShareLink: async (vocabularyId, boardId) => {
			await apiFetch(`/vocabularies/${vocabularyId}/boards/${boardId}/share-link`, {
				method: 'DELETE',
				accessToken
			});
		}
	};
}

export type SharedVocabulary = {
	share: {
		kind: 'vocabulary' | 'board';
		vocabulary: Vocabulary;
		board: Board | null;
	};
	content: VocabularyContent;
};

/** Open a Share Link. The token is the whole permission — there is no session. */
export function loadSharedVocabulary(token: string): Promise<SharedVocabulary> {
	return apiFetch<SharedVocabulary>(`/shared/${token}`);
}

/**
 * A Vocabulary as a Visitor following a Share Link sees it: already fetched,
 * and not theirs to write. Nothing here can reach the source Vocabulary.
 */
export function sharedVocabularySource(content: VocabularyContent): VocabularySource {
	const refused = () => Promise.reject(new Error('Sign in to keep your own copy of this.'));
	return {
		canWrite: false,
		loadContent: async () => content,
		loadSuggestedChangeSets: async () => [],
		listCopyDestinations: async () => [],
		copyBoard: refused,
		uploadSymbol: refused,
		readBoardShareLink: async () => null,
		createBoardShareLink: refused,
		revokeBoardShareLink: refused
	};
}

/**
 * Keep what a Share Link showed you as a Vocabulary of your own. The snapshot
 * is the Visitor's visible state, their edits folded in.
 */
export function saveSharedVocabulary(
	token: string,
	accessToken: string,
	name: string,
	snapshot: unknown
): Promise<{ vocabulary: Vocabulary }> {
	return apiFetch<{ vocabulary: Vocabulary }>(`/shared/${token}/save`, {
		method: 'POST',
		accessToken,
		body: JSON.stringify({ name, snapshot })
	});
}

/**
 * Keep a Board that arrived through a Share Link. With no destination it
 * becomes a Vocabulary of its own; with one, it is copied into a Vocabulary
 * the saver already manages.
 */
export function saveSharedBoard(
	token: string,
	accessToken: string,
	body: { destinationVocabularyId?: string; name: string; snapshot: unknown }
): Promise<{ vocabulary?: Vocabulary; vocabularyId?: string; boardId?: string }> {
	return apiFetch(`/shared/${token}/save-board`, {
		method: 'POST',
		accessToken,
		body: JSON.stringify(body)
	});
}

export type PublicationFigures = {
	boardCount: number;
	buttonCount: number;
	minColumns: number;
	minRows: number;
	maxColumns: number;
	maxRows: number;
};

export type GalleryPublication = {
	publication: {
		slug: string;
		endorsementCount: number;
		youEndorsed: boolean;
		title: string;
		description: string;
		attribution: string;
		versionId: string;
		seq: number;
		publishedAt: string;
		figures: PublicationFigures;
	};
	content: VocabularyContent;
};

export type PublicationSummary = {
	slug: string;
	endorsementCount: number;
	title: string;
	description: string;
	attribution: string;
	publishedAt: string;
	figures: PublicationFigures;
};

/** Browse the Gallery. Anonymous, and nothing is recorded by looking. */
export async function loadGallery(
	query: string,
	sort: 'endorsed' | 'newest' = 'endorsed'
): Promise<PublicationSummary[]> {
	const params = new URLSearchParams();
	if (query.trim()) params.set('q', query.trim());
	params.set('sort', sort);
	const data = await apiFetch<{ publications: PublicationSummary[] }>(`/gallery?${params}`);
	return data.publications;
}

/**
 * Open a Publication on the Gallery. Everything returned comes from a frozen
 * Publication Version, so this shows what was published rather than what the
 * source Vocabulary has since become.
 */
export function loadPublication(slug: string, accessToken?: string): Promise<GalleryPublication> {
	return apiFetch<GalleryPublication>(`/gallery/${slug}`, { accessToken });
}

/** Endorse a Publication, or withdraw it. The standing count comes back with it. */
export function setEndorsement(
	slug: string,
	standing: boolean,
	accessToken: string
): Promise<{ standing: boolean; count: number }> {
	return apiFetch(`/gallery/${slug}/endorsement`, {
		method: 'POST',
		accessToken,
		body: JSON.stringify({ standing })
	});
}

/**
 * Keep a Publication as a Vocabulary of your own. The snapshot is what the
 * Visitor can see, their own local edits folded in.
 */
export function copyPublication(
	slug: string,
	accessToken: string,
	body: { name?: string; snapshot?: unknown }
): Promise<{ vocabulary: Vocabulary }> {
	return apiFetch(`/gallery/${slug}/copy`, {
		method: 'POST',
		accessToken,
		body: JSON.stringify(body)
	});
}

/** Report a Publication. Signing in is optional; a reason is not. */
export function reportPublication(
	slug: string,
	reason: string,
	accessToken?: string
): Promise<{ reported: boolean }> {
	return apiFetch(`/gallery/${slug}/reports`, {
		method: 'POST',
		accessToken,
		body: JSON.stringify({ reason })
	});
}

/** The Vocabularies a signed-in saver could keep a shared Board in. */
export async function listOwnVocabularies(accessToken: string): Promise<Vocabulary[]> {
	return (await apiFetch<{ vocabularies: Vocabulary[] }>('/vocabularies', { accessToken }))
		.vocabularies;
}
