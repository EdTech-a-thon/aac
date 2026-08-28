import { describe, expect, it } from 'vitest';
import { loadVocabularyContent, type VocabularyReader } from './vocabularyContent';
import type { Board, BoardButton, PaletteColor, SnippetInclusion, UnresolvedCopyAction } from './types';

function board(id: string, overrides: Partial<Board> = {}): Board {
	return {
		id,
		vocabulary_id: 'vocab',
		name: id,
		displayName: id,
		width: 4,
		height: 3,
		kind: 'board',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

function button(id: string, boardId: string): BoardButton {
	return {
		id,
		board_id: boardId,
		row_index: 0,
		col_index: 0,
		label: id,
		background_color: null,
		palette_color_id: null,
		action: null,
		symbol_digest: null,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z'
	};
}

type ReaderParts = {
	boards?: Board[];
	buttons?: Record<string, BoardButton[]>;
	paletteColors?: PaletteColor[];
	snippetInclusions?: SnippetInclusion[];
	unresolvedCopyActions?: UnresolvedCopyAction[];
};

function fakeReader(parts: ReaderParts) {
	const buttonRequests: string[] = [];
	const reader: VocabularyReader = {
		boards: async () => parts.boards ?? [],
		paletteColors: async () => parts.paletteColors ?? [],
		snippetInclusions: async () => parts.snippetInclusions ?? [],
		unresolvedCopyActions: async () => parts.unresolvedCopyActions ?? [],
		buttons: async (_vocabularyId, boardId) => {
			buttonRequests.push(boardId);
			return parts.buttons?.[boardId] ?? [];
		}
	};
	return { reader, buttonRequests };
}

describe('loadVocabularyContent', () => {
	it('assembles everything the canvas draws, with Buttons grouped by their Board', async () => {
		const { reader } = fakeReader({
			boards: [board('home'), board('food')],
			buttons: { home: [button('b1', 'home')], food: [button('b2', 'food'), button('b3', 'food')] },
			paletteColors: [
				{
					id: 'c1',
					vocabulary_id: 'vocab',
					hex: '#ffcc00',
					name: 'noun',
					description: '',
					position: 0,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			],
			snippetInclusions: [
				{
					id: 'i1',
					host_id: 'home',
					snippet_id: 'strip',
					origin_row: 0,
					origin_col: 1,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			],
			unresolvedCopyActions: [
				{
					id: 'w1',
					vocabulary_id: 'vocab',
					button_id: 'b2',
					previous_board_name: 'Snacks',
					created_at: '2026-01-01T00:00:00Z'
				}
			]
		});

		const content = await loadVocabularyContent('vocab', reader);

		expect(content.boards.map((entry) => entry.id)).toEqual(['home', 'food']);
		expect(content.buttonsByBoardId.home.map((entry) => entry.id)).toEqual(['b1']);
		expect(content.buttonsByBoardId.food.map((entry) => entry.id)).toEqual(['b2', 'b3']);
		expect(content.paletteColors).toHaveLength(1);
		expect(content.snippetInclusions).toHaveLength(1);
		expect(content.unresolvedCopyActions).toHaveLength(1);
	});

	it('gives every grid a definite kind, so Snippets stay distinguishable from Boards', async () => {
		const { reader } = fakeReader({
			boards: [
				board('home', { kind: undefined as unknown as Board['kind'] }),
				board('strip', { kind: 'snippet' })
			]
		});

		const content = await loadVocabularyContent('vocab', reader);

		expect(content.boards.map((entry) => entry.kind)).toEqual(['board', 'snippet']);
	});

	it('asks for the Buttons of every grid exactly once, Snippets included', async () => {
		const { reader, buttonRequests } = fakeReader({
			boards: [board('home'), board('strip', { kind: 'snippet' })]
		});

		await loadVocabularyContent('vocab', reader);

		expect(buttonRequests.sort()).toEqual(['home', 'strip']);
	});

	it('returns empty content for an empty Vocabulary without asking for Buttons', async () => {
		const { reader, buttonRequests } = fakeReader({});

		const content = await loadVocabularyContent('vocab', reader);

		expect(content.boards).toEqual([]);
		expect(content.buttonsByBoardId).toEqual({});
		expect(buttonRequests).toEqual([]);
	});

	it('gives every Board an entry even when it holds no Buttons', async () => {
		const { reader } = fakeReader({ boards: [board('home')] });

		const content = await loadVocabularyContent('vocab', reader);

		expect(content.buttonsByBoardId).toEqual({ home: [] });
	});

	it('surfaces a read failure rather than reporting partial content', async () => {
		const { reader } = fakeReader({ boards: [board('home')] });
		reader.paletteColors = async () => {
			throw new Error('Vocabulary not found');
		};

		await expect(loadVocabularyContent('vocab', reader)).rejects.toThrow('Vocabulary not found');
	});
});
