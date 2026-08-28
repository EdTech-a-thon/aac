import { DEFAULT_BUTTON_COLOR } from './fitzgeraldColors';

/** The colour-bearing fields of a Button, as every renderer of a Button sees them. */
export type ButtonFaceColors = {
	background_color: string | null;
	palette_color_id: string | null;
};

/**
 * The hex a Button is painted with: its bound Palette Color if it has one,
 * otherwise its custom hex, otherwise the unset default.
 */
export function resolveButtonHex(
	button: ButtonFaceColors,
	paletteHexById: Record<string, string>
): string {
	if (button.palette_color_id) {
		const hex = paletteHexById[button.palette_color_id];
		if (hex) return hex;
	}
	return button.background_color ?? DEFAULT_BUTTON_COLOR;
}
