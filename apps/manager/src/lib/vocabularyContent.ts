import type {
	Board,
	BoardButton,
	PaletteColor,
	SnippetInclusion,
	UnresolvedCopyAction
} from './types';

/**
 * Everything the canvas needs to draw a Vocabulary, however it was fetched.
 * A signed-in Manager reads it through their session; a Visitor following a
 * Share Link will read the same shape through the link.
 */
export type VocabularyContent = {
	boards: Board[];
	buttonsByBoardId: Record<string, BoardButton[]>;
	paletteColors: PaletteColor[];
	snippetInclusions: SnippetInclusion[];
	unresolvedCopyActions: UnresolvedCopyAction[];
};

/** The reads a Vocabulary's content is assembled from, whatever supplies them. */
export type VocabularyReader = {
	boards(vocabularyId: string): Promise<Board[]>;
	paletteColors(vocabularyId: string): Promise<PaletteColor[]>;
	snippetInclusions(vocabularyId: string): Promise<SnippetInclusion[]>;
	unresolvedCopyActions(vocabularyId: string): Promise<UnresolvedCopyAction[]>;
	buttons(vocabularyId: string, boardId: string): Promise<BoardButton[]>;
};

/** A grid without a kind is a Board; only Snippets say so. */
function withGridKind(board: Board): Board {
	return { ...board, kind: board.kind === 'snippet' ? 'snippet' : 'board' };
}

export async function loadVocabularyContent(
	vocabularyId: string,
	reader: VocabularyReader
): Promise<VocabularyContent> {
	const [boards, paletteColors, snippetInclusions, unresolvedCopyActions] = await Promise.all([
		reader.boards(vocabularyId),
		reader.paletteColors(vocabularyId),
		reader.snippetInclusions(vocabularyId),
		reader.unresolvedCopyActions(vocabularyId)
	]);

	const buttonsByBoardId: Record<string, BoardButton[]> = {};
	await Promise.all(
		boards.map(async (board) => {
			buttonsByBoardId[board.id] = await reader.buttons(vocabularyId, board.id);
		})
	);

	return {
		boards: boards.map(withGridKind),
		buttonsByBoardId,
		paletteColors,
		snippetInclusions,
		unresolvedCopyActions
	};
}
