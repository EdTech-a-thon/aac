import { describe, expect, it } from 'vitest';
import { diffPaletteMutations } from './changeSetMutations';

describe('diffPaletteMutations', () => {
	it('emits create, update, and delete for Palette Colors', () => {
		const base = [
			{
				id: 'c1',
				hex: '#ffb74d',
				name: 'Nouns',
				description: 'Things',
				position: 0
			},
			{
				id: 'c2',
				hex: '#a8d08d',
				name: 'Verbs',
				description: 'Actions',
				position: 1
			}
		];
		const current = [
			{
				id: 'c1',
				hex: '#ff9900',
				name: 'Things',
				description: 'Things',
				position: 0
			},
			{
				id: 'c3',
				hex: '#112233',
				name: 'Custom',
				description: '',
				position: 1
			}
		];

		expect(diffPaletteMutations(base, current)).toEqual([
			{
				op: 'update_palette_color',
				id: 'c1',
				hex: '#ff9900',
				name: 'Things'
			},
			{
				op: 'create_palette_color',
				id: 'c3',
				hex: '#112233',
				name: 'Custom',
				description: '',
				position: 1
			},
			{ op: 'delete_palette_color', id: 'c2' }
		]);
	});
});
