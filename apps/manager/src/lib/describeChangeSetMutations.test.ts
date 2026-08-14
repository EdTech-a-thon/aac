import { describe, expect, it } from 'vitest';
import {
	asChangeSetMutations,
	describeChangeSetMutations,
	normalizeSuggestedChangeSets,
	type MutationLookupContext
} from './describeChangeSetMutations';

const ctx: MutationLookupContext = {
	boards: [
		{ id: 'board-1', name: 'Home', width: 3, height: 4 },
		{ id: 'board-2', name: '', width: 2, height: 2 }
	],
	buttons: [
		{
			id: 'btn-1',
			board_id: 'board-1',
			label: 'eat',
			row_index: 0,
			col_index: 1
		},
		{
			id: 'btn-2',
			board_id: 'board-1',
			label: '',
			row_index: 1,
			col_index: 0
		}
	],
	paletteColors: [
		{ id: 'color-1', name: 'Nouns', hex: '#ff0000' },
		{ id: 'color-2', name: '', hex: '#00ff00' }
	]
};

describe('describeChangeSetMutations', () => {
	it('describes board create, update, and delete', () => {
		expect(
			describeChangeSetMutations(
				[
					{ op: 'create_board', id: 'b-new', name: 'Food', width: 4, height: 5 },
					{ op: 'update_board', id: 'board-1', name: 'Main', width: 5 },
					{ op: 'delete_board', id: 'board-2' }
				],
				ctx
			)
		).toEqual([
			'Create board “Food” (4×5)',
			'Update board “Home”: rename to “Main”; resize to 5×4',
			'Delete board “Untitled”'
		]);
	});

	it('describes Snippet create, update, and delete', () => {
		expect(
			describeChangeSetMutations(
				[
					{
						op: 'create_board',
						id: 'snip-new',
						name: 'Common actions',
						width: 6,
						height: 1,
						kind: 'snippet'
					},
					{ op: 'update_board', id: 'snip-1', name: 'Actions' },
					{ op: 'delete_board', id: 'snip-1' }
				],
				{
					...ctx,
					boards: [
						...ctx.boards,
						{ id: 'snip-1', name: 'Strip', width: 6, height: 1, kind: 'snippet' }
					]
				}
			)
		).toEqual([
			'Create snippet “Common actions” (6×1)',
			'Update snippet “Strip”: rename to “Actions”',
			'Delete snippet “Strip”'
		]);
	});

	it('describes Snippet Inclusion create, move, and delete', () => {
		expect(
			describeChangeSetMutations(
				[
					{
						op: 'create_snippet_inclusion',
						id: 'inc-new',
						host_id: 'board-1',
						snippet_id: 'snip-1',
						origin_row: 0,
						origin_col: 1
					},
					{ op: 'update_snippet_inclusion', id: 'inc-1', origin_row: 1, origin_col: 2 },
					{ op: 'delete_snippet_inclusion', id: 'inc-1' }
				],
				{
					...ctx,
					boards: [
						...ctx.boards,
						{ id: 'snip-1', name: 'Strip', width: 6, height: 1, kind: 'snippet' }
					],
					snippetInclusions: [
						{
							id: 'inc-1',
							host_id: 'board-1',
							snippet_id: 'snip-1',
							origin_row: 0,
							origin_col: 0
						}
					]
				}
			)
		).toEqual([
			'Create Snippet Inclusion of “Strip” on “Home” at B1',
			'Update Snippet Inclusion of “Strip” on “Home”: move to C2',
			'Delete Snippet Inclusion of “Strip” on “Home”'
		]);
	});

	it('names a newly created Snippet when describing its inclusion', () => {
		expect(
			describeChangeSetMutations(
				[
					{
						op: 'create_board',
						id: 'snip-new',
						name: 'Quick yes',
						width: 6,
						height: 1,
						kind: 'snippet'
					},
					{
						op: 'create_snippet_inclusion',
						id: 'inc-new',
						host_id: 'board-1',
						snippet_id: 'snip-new',
						origin_row: 1,
						origin_col: 0
					}
				],
				ctx
			)
		).toEqual([
			'Create snippet “Quick yes” (6×1)',
			'Create Snippet Inclusion of “Quick yes” on “Home” at A2'
		]);
	});

	it('describes button create, update, and delete with resolved names', () => {
		expect(
			describeChangeSetMutations(
				[
					{
						op: 'create_button',
						id: 'btn-new',
						board_id: 'board-1',
						row_index: 2,
						col_index: 3,
						label: 'drink',
						palette_color_id: 'color-1',
						action: { kind: 'insert_phrase', phrase: 'I want a drink' }
					},
					{
						op: 'update_button',
						id: 'btn-1',
						row_index: 1,
						col_index: 2,
						label: 'food',
						background_color: '#abcdef',
						palette_color_id: null,
						action: { kind: 'open_board', board_id: 'board-2' }
					},
					{ op: 'delete_button', id: 'btn-2' }
				],
				ctx
			)
		).toEqual([
			'Create \'drink\' button on “Home” at D3; color Palette Color “Nouns” (#ff0000); Action Insert Phrase (“I want a drink”)',
			'Update \'eat\' button on “Home”: move to C2; rename to “food”; set color to custom #abcdef; set Action to Open Board (“Untitled”)',
			'Delete untitled button on “Home” at A2'
		]);
	});

	it('describes palette color create, update, and delete', () => {
		expect(
			describeChangeSetMutations(
				[
					{
						op: 'create_palette_color',
						id: 'c-new',
						hex: '#0000ff',
						name: 'Verbs',
						description: 'Actions',
						position: 2
					},
					{
						op: 'update_palette_color',
						id: 'color-1',
						hex: '#aa0000',
						name: 'People'
					},
					{ op: 'delete_palette_color', id: 'color-2' }
				],
				ctx
			)
		).toEqual([
			'Add Palette Color “Verbs” (#0000ff)',
			'Update Palette Color “Nouns” (#ff0000): hex → #aa0000; rename to “People”',
			'Delete Palette Color unnamed color (#00ff00)'
		]);
	});
});

describe('asChangeSetMutations', () => {
	it('keeps recognized ops and drops junk', () => {
		expect(
			asChangeSetMutations([
				{ op: 'delete_button', id: 'btn-1' },
				{ op: 'not_real' },
				null,
				'nope'
			])
		).toEqual([{ op: 'delete_button', id: 'btn-1' }]);
	});
});

describe('normalizeSuggestedChangeSets', () => {
	it('normalizes status and mutations', () => {
		expect(
			normalizeSuggestedChangeSets([
				{
					id: 'cs-1',
					author_id: null,
					created_at: '2026-01-01T00:00:00Z',
					mutations: [{ op: 'delete_button', id: 'btn-1' }, { op: 'nope' }]
				}
			])
		).toEqual([
			{
				id: 'cs-1',
				author_id: null,
				created_at: '2026-01-01T00:00:00Z',
				status: 'suggested',
				mutations: [{ op: 'delete_button', id: 'btn-1' }]
			}
		]);
	});
});
