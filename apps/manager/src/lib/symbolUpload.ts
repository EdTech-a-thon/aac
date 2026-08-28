/**
 * What the browser does with an image before it becomes a Symbol.
 *
 * The digest identifying a Symbol is a pure function of the bytes we store, so
 * anything we re-encode gets browser-dependent bytes and will not deduplicate
 * across users. Passing small images through untouched is therefore not an
 * optimisation: it is what makes shared symbol sets store exactly once.
 */

/** Client target. The server's own cap is higher, leaving headroom. */
export const MAX_SYMBOL_UPLOAD_BYTES = 1024 * 1024;

/** A Button is a few hundred CSS pixels; this covers 2x density with room over. */
export const MAX_SYMBOL_EDGE = 1024;

export type SymbolSourceType = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg' | null;

export type SymbolUploadCandidate = {
	byteLength: number;
	width: number;
	height: number;
	hasAlpha: boolean;
	type: SymbolSourceType;
};

export type SymbolUploadDecision =
	| { action: 'passthrough' }
	| { action: 'reencode'; format: 'png' | 'jpeg'; maxEdge: number }
	| { action: 'reject'; reason: string };

export function decideUpload(candidate: SymbolUploadCandidate): SymbolUploadDecision {
	if (candidate.type === 'svg') {
		return { action: 'reject', reason: 'SVG images are not supported' };
	}
	if (candidate.type === null) {
		return { action: 'reject', reason: 'That file is not a supported image' };
	}
	if (candidate.width < 1 || candidate.height < 1) {
		return { action: 'reject', reason: 'That image could not be read' };
	}

	const withinBytes = candidate.byteLength <= MAX_SYMBOL_UPLOAD_BYTES;
	const withinEdge = Math.max(candidate.width, candidate.height) <= MAX_SYMBOL_EDGE;
	if (withinBytes && withinEdge) {
		return { action: 'passthrough' };
	}

	// Alpha must survive: a transparent Symbol takes the colour of its Button.
	// Never WebP — the AAC app renders through React Native's built-in image.
	return {
		action: 'reencode',
		format: candidate.hasAlpha ? 'png' : 'jpeg',
		maxEdge: MAX_SYMBOL_EDGE
	};
}
