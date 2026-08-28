import { describe, expect, it } from 'vitest';
import { decideUpload, MAX_SYMBOL_EDGE, MAX_SYMBOL_UPLOAD_BYTES } from './symbolUpload';

const KB = 1024;

function candidate(partial: Partial<Parameters<typeof decideUpload>[0]> = {}) {
	return {
		byteLength: 40 * KB,
		width: 512,
		height: 512,
		hasAlpha: false,
		type: 'png' as const,
		...partial
	};
}

describe('decideUpload', () => {
	it('passes a small in-bounds image through untouched, so symbol sets deduplicate', () => {
		expect(decideUpload(candidate())).toEqual({ action: 'passthrough' });
	});

	it('passes through at exactly the byte and edge limits', () => {
		expect(
			decideUpload(
				candidate({
					byteLength: MAX_SYMBOL_UPLOAD_BYTES,
					width: MAX_SYMBOL_EDGE,
					height: MAX_SYMBOL_EDGE
				})
			)
		).toEqual({ action: 'passthrough' });
	});

	it('re-encodes an image over the byte cap', () => {
		expect(decideUpload(candidate({ byteLength: MAX_SYMBOL_UPLOAD_BYTES + 1 }))).toMatchObject({
			action: 'reencode'
		});
	});

	it('re-encodes an image wider than the edge cap even when its bytes are small', () => {
		expect(
			decideUpload(candidate({ byteLength: 10 * KB, width: MAX_SYMBOL_EDGE + 1 }))
		).toMatchObject({ action: 'reencode', maxEdge: MAX_SYMBOL_EDGE });
	});

	it('re-encodes a tall image over the edge cap', () => {
		expect(
			decideUpload(candidate({ byteLength: 10 * KB, height: MAX_SYMBOL_EDGE + 1 }))
		).toMatchObject({ action: 'reencode' });
	});

	it('re-encodes to PNG when the image has transparency, so it keeps its alpha', () => {
		expect(
			decideUpload(candidate({ byteLength: 4_000_000, hasAlpha: true }))
		).toMatchObject({ action: 'reencode', format: 'png' });
	});

	it('re-encodes to JPEG when the image has no transparency', () => {
		expect(
			decideUpload(candidate({ byteLength: 4_000_000, hasAlpha: false, type: 'jpeg' }))
		).toMatchObject({ action: 'reencode', format: 'jpeg' });
	});

	it('never re-encodes to WebP, which the AAC app cannot be relied on to render', () => {
		const decision = decideUpload(candidate({ byteLength: 4_000_000, type: 'webp' }));
		expect(decision).toMatchObject({ action: 'reencode' });
		if (decision.action === 'reencode') expect(decision.format).not.toBe('webp');
	});

	it('rejects SVG', () => {
		expect(decideUpload(candidate({ type: 'svg' }))).toMatchObject({ action: 'reject' });
	});

	it('rejects an unrecognised type', () => {
		expect(decideUpload(candidate({ type: null }))).toMatchObject({ action: 'reject' });
	});

	it('rejects an undecodable image with no dimensions', () => {
		expect(decideUpload(candidate({ width: 0, height: 0 }))).toMatchObject({ action: 'reject' });
	});

	it('gives a reason with every rejection', () => {
		for (const c of [candidate({ type: 'svg' }), candidate({ type: null })]) {
			const decision = decideUpload(c);
			expect(decision.action).toBe('reject');
			if (decision.action === 'reject') expect(decision.reason.length).toBeGreaterThan(0);
		}
	});
});
