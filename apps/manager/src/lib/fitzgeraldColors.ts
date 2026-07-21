/** Modified Fitzgerald Key–inspired presets for AAC button backgrounds. */
export const FITZGERALD_COLORS = [
	{ id: 'white', label: 'White', hex: '#ffffff', category: 'Conjunctions' },
	{ id: 'yellow', label: 'Yellow', hex: '#ffe566', category: 'Pronouns' },
	{ id: 'green', label: 'Green', hex: '#a8d08d', category: 'Verbs' },
	{ id: 'orange', label: 'Orange', hex: '#ffb74d', category: 'Nouns' },
	{ id: 'blue', label: 'Blue', hex: '#90caf9', category: 'Adjectives' },
	{ id: 'pink', label: 'Pink', hex: '#f8bbd0', category: 'Prepositions / social' },
	{ id: 'purple', label: 'Purple', hex: '#ce93d8', category: 'Questions' },
	{ id: 'brown', label: 'Brown', hex: '#bcaaa4', category: 'Adverbs' },
	{ id: 'red', label: 'Red', hex: '#ef9a9a', category: 'Negation / emergency' },
	{ id: 'grey', label: 'Grey', hex: '#bdbdbd', category: 'Determiners' }
] as const;

export const DEFAULT_BUTTON_COLOR = '#ffffff';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHexColor(value: string): string | null {
	const trimmed = value.trim();
	if (!HEX_COLOR.test(trimmed)) return null;
	return trimmed.toLowerCase();
}

export function contrastingTextColor(background: string): string {
	const hex = normalizeHexColor(background) ?? DEFAULT_BUTTON_COLOR;
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	// Relative luminance threshold for readable label color
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.65 ? '#1e293b' : '#ffffff';
}
