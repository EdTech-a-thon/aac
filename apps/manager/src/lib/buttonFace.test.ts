import { describe, expect, it } from 'vitest';
import { resolveButtonHex } from './buttonFace';
import { DEFAULT_BUTTON_COLOR } from './fitzgeraldColors';

describe('resolveButtonHex', () => {
	it('uses the custom hex when the Button has no Palette Color binding', () => {
		expect(resolveButtonHex({ background_color: '#123456', palette_color_id: null }, {})).toBe(
			'#123456'
		);
	});

	it('uses the bound Palette Color hex in preference to anything else', () => {
		expect(
			resolveButtonHex(
				{ background_color: null, palette_color_id: 'pc-1' },
				{ 'pc-1': '#ffe566' }
			)
		).toBe('#ffe566');
	});

	it('falls back when the bound Palette Color is not in the lookup', () => {
		expect(
			resolveButtonHex({ background_color: '#123456', palette_color_id: 'missing' }, {})
		).toBe('#123456');
	});

	it('renders an unset background as the default', () => {
		expect(resolveButtonHex({ background_color: null, palette_color_id: null }, {})).toBe(
			DEFAULT_BUTTON_COLOR
		);
	});
});
