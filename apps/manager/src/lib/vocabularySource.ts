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
		uploadSymbol: (file) => uploadSymbol(file, accessToken)
	};
}

export type SharedVocabulary = {
	share: { kind: 'vocabulary'; vocabulary: Vocabulary };
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
		uploadSymbol: refused
	};
}
