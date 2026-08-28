import {
	decideUpload,
	MAX_SYMBOL_UPLOAD_BYTES,
	type SymbolSourceType
} from './symbolUpload';

/** Thin browser wrapper around the upload policy; the decisions live there. */

async function sniffType(file: Blob): Promise<SymbolSourceType> {
	const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
	const ascii = (offset: number, length: number) =>
		String.fromCharCode(...head.slice(offset, offset + length));

	if (
		head[0] === 0x89 &&
		head[1] === 0x50 &&
		head[2] === 0x4e &&
		head[3] === 0x47
	) {
		return 'png';
	}
	if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
	if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
	if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';

	const text = ascii(0, Math.min(head.length, 256)).trimStart().toLowerCase();
	if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) {
		return 'svg';
	}
	return null;
}

/**
 * Whether any pixel is not fully opaque. Probed on a small downscale: alpha
 * survives interpolation, so a transparent region still reads as < 255, and a
 * fully opaque image never does. Without this every non-JPEG would re-encode as
 * PNG, which has no quality dial, so a big opaque screenshot would stay big.
 */
function hasTransparency(bitmap: ImageBitmap): boolean {
	const probe = 128;
	const scale = Math.min(1, probe / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return true;
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	try {
		const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] < 255) return true;
		}
	} catch {
		// Tainted canvas or a blocked read: assume alpha rather than flatten it.
		return true;
	}
	return false;
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | null> {
	try {
		return await createImageBitmap(file);
	} catch {
		return null;
	}
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Turn a picked, dropped or pasted file into the bytes we will store.
 * Small in-bounds images are returned untouched so that identical source files
 * produce identical bytes, and therefore one stored Symbol.
 */
export async function prepareSymbolFile(file: File | Blob): Promise<Blob> {
	const type = await sniffType(file);
	const bitmap = await loadBitmap(file);

	const decision = decideUpload({
		byteLength: file.size,
		width: bitmap?.width ?? 0,
		height: bitmap?.height ?? 0,
		// JPEG cannot carry alpha at all; for the rest, look.
		hasAlpha: type !== 'jpeg' && bitmap !== null && hasTransparency(bitmap),
		type
	});

	if (decision.action === 'reject') {
		bitmap?.close();
		throw new Error(decision.reason);
	}
	if (decision.action === 'passthrough' || !bitmap) {
		bitmap?.close();
		return file;
	}

	const scale = Math.min(1, decision.maxEdge / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		bitmap.close();
		return file;
	}
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	if (decision.format === 'png') {
		return (await toBlob(canvas, 'image/png')) ?? file;
	}

	// Step quality down until it fits, rather than shrinking further.
	for (const quality of [0.85, 0.7, 0.55, 0.4]) {
		const blob = await toBlob(canvas, 'image/jpeg', quality);
		if (blob && blob.size <= MAX_SYMBOL_UPLOAD_BYTES) return blob;
		if (quality === 0.4 && blob) return blob;
	}
	return file;
}
