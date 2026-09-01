import { describe, expect, it } from "vitest";
import {
  isStorableImageType,
  MAX_SYMBOL_BYTES,
  sniffImageType,
  symbolDigest,
} from "../symbolBytes.js";

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      for (const ch of part) flat.push(ch.charCodeAt(0));
    } else {
      flat.push(...part);
    }
  }
  return new Uint8Array(flat);
}

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF");
const GIF = bytes("GIF89a", [1, 0, 1, 0]);
const WEBP = bytes("RIFF", [36, 0, 0, 0], "WEBP", "VP8 ");

describe("sniffImageType", () => {
  it("recognises the formats a Symbol may be stored as", () => {
    expect(sniffImageType(PNG)).toBe("png");
    expect(sniffImageType(JPEG)).toBe("jpeg");
    expect(sniffImageType(GIF)).toBe("gif");
    expect(sniffImageType(WEBP)).toBe("webp");
  });

  it("recognises SVG so it can be refused by name", () => {
    expect(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("svg");
    expect(sniffImageType(bytes('<?xml version="1.0"?><svg></svg>'))).toBe("svg");
    expect(sniffImageType(bytes("   \n<SVG></SVG>"))).toBe("svg");
  });

  it("refuses to store SVG or anything unrecognised", () => {
    expect(isStorableImageType(sniffImageType(bytes("<svg></svg>")))).toBe(false);
    expect(isStorableImageType(sniffImageType(bytes("not an image at all")))).toBe(false);
    expect(isStorableImageType(sniffImageType(new Uint8Array()))).toBe(false);
  });

  it("accepts the storable formats", () => {
    expect(isStorableImageType(sniffImageType(PNG))).toBe(true);
    expect(isStorableImageType(sniffImageType(WEBP))).toBe(true);
  });

  it("judges bytes rather than a declared content type", () => {
    // Bytes that claim nothing: identity comes only from the signature.
    expect(sniffImageType(bytes("RIFF", [0, 0, 0, 0], "AVI "))).toBe(null);
  });
});

describe("symbolDigest", () => {
  it("is stable for identical bytes, so uploading twice is idempotent", () => {
    expect(symbolDigest(PNG)).toBe(symbolDigest(new Uint8Array(PNG)));
  });

  it("differs for different bytes", () => {
    expect(symbolDigest(PNG)).not.toBe(symbolDigest(JPEG));
  });

  it("is a 64-character lowercase hex string, matching the Button column constraint", () => {
    expect(symbolDigest(PNG)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("MAX_SYMBOL_BYTES", () => {
  it("leaves headroom above the 1MB the client targets", () => {
    expect(MAX_SYMBOL_BYTES).toBeGreaterThan(1024 * 1024);
  });
});
