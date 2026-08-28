import { describe, expect, it } from "vitest";
import { createTestUser, testApp } from "./helpers.ts";

/**
 * The upload path at its highest seam: a real request through the real app.
 *
 * Requires the Symbol migration to be applied (for the bucket) and
 * SUPABASE_SERVICE_ROLE_KEY to be set; without the key the endpoint answers 503
 * by design, which these tests assert against rather than silently skipping.
 */

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

/** A real 1x1 PNG, so the bytes survive format sniffing. */
const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

async function upload(
  app: ReturnType<typeof testApp>,
  body: Uint8Array,
  options: { accessToken?: string; contentType?: string } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": options.contentType ?? "application/octet-stream",
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  const res = await app.request("/symbols", {
    method: "POST",
    headers,
    // Cast: TS types Uint8Array as ArrayBufferLike-backed, BlobPart wants ArrayBuffer.
    body: new Blob([body as unknown as BlobPart]),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as { digest?: string; url?: string; error?: string }) : {},
  };
}

describe("Symbol upload", () => {
  it("refuses an unauthenticated request", async () => {
    const res = await upload(testApp(), PNG_1X1);
    expect(res.status).toBe(401);
  });

  it("stores image bytes and returns the digest that names them", async () => {
    const user = await createTestUser();
    const res = await upload(testApp(), PNG_1X1, { accessToken: user.accessToken });
    expect(res.status).toBe(200);
    expect(res.body.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.url).toContain(res.body.digest);
  });

  it("is idempotent: the same bytes twice yield the same digest", async () => {
    const user = await createTestUser();
    const app = testApp();
    const first = await upload(app, PNG_1X1, { accessToken: user.accessToken });
    const second = await upload(app, PNG_1X1, { accessToken: user.accessToken });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.digest).toBe(first.body.digest);
  });

  it("rejects SVG", async () => {
    const user = await createTestUser();
    const res = await upload(testApp(), bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
      accessToken: user.accessToken,
      contentType: "image/svg+xml",
    });
    expect(res.status).toBe(415);
  });

  it("judges the bytes, not the declared content type", async () => {
    const user = await createTestUser();
    const res = await upload(testApp(), bytes("this is definitely not a PNG"), {
      accessToken: user.accessToken,
      contentType: "image/png",
    });
    expect(res.status).toBe(415);
  });

  it("rejects an empty body", async () => {
    const user = await createTestUser();
    const res = await upload(testApp(), new Uint8Array(), {
      accessToken: user.accessToken,
    });
    expect(res.status).toBe(400);
  });

  it("rejects bytes over the size cap", async () => {
    const user = await createTestUser();
    const oversize = new Uint8Array(2 * 1024 * 1024 + 1);
    oversize.set(PNG_1X1, 0);
    const res = await upload(testApp(), oversize, { accessToken: user.accessToken });
    expect(res.status).toBe(413);
  });
});

describe("Symbol read", () => {
  it("resolves a digest to its bytes without authentication", async () => {
    const digest = "a".repeat(64);
    const res = await testApp().request(`/symbols/${digest}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(digest);
  });

  it("does not treat a non-digest as an object key", async () => {
    const res = await testApp().request("/symbols/not-a-digest");
    expect(res.status).toBe(404);
  });
});
