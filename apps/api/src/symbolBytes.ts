import { createHash } from "node:crypto";

/** Hard cap on stored Symbol bytes. The client aims well under this. */
export const MAX_SYMBOL_BYTES = 2 * 1024 * 1024;

export type SymbolImageType = "png" | "jpeg" | "webp" | "gif";

/** Types we can recognise but refuse to store, kept distinct from "unknown". */
export type RejectedImageType = "svg";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

/**
 * Identify an image by its bytes rather than its declared content type.
 * Returns null for anything unrecognised.
 */
export function sniffImageType(
  bytes: Uint8Array,
): SymbolImageType | RejectedImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return "gif";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }

  // SVG is a document, not an image: recognised so it can be refused by name.
  const head = ascii(bytes, 0, Math.min(bytes.length, 256))
    .replace(/^﻿/, "")
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "svg";
  }

  return null;
}

export function isStorableImageType(
  type: ReturnType<typeof sniffImageType>,
): type is SymbolImageType {
  return type === "png" || type === "jpeg" || type === "webp" || type === "gif";
}

export const CONTENT_TYPE_BY_IMAGE_TYPE: Record<SymbolImageType, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** The Symbol's identity: a sha256 of exactly the bytes we store. */
export function symbolDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
