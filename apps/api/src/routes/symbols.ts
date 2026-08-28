import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "../middleware/auth.ts";
import { createServiceSupabaseClient, symbolPublicUrl } from "../supabase.ts";
import {
  CONTENT_TYPE_BY_IMAGE_TYPE,
  isStorableImageType,
  MAX_SYMBOL_BYTES,
  sniffImageType,
  symbolDigest,
} from "../symbolBytes.ts";

/** Public-read, service-role-write. One object per distinct digest. */
export const SYMBOL_BUCKET = "symbols";

/** A year, in seconds: bytes behind a digest can never change. */
const IMMUTABLE_CACHE_SECONDS = "31536000";

export const symbolRoutes = new Hono<{ Variables: AuthVariables }>();

function isAlreadyStored(error: { message?: string; statusCode?: string }): boolean {
  if (error.statusCode === "409") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("already exists") || message.includes("duplicate");
}

/**
 * Store image bytes and return the digest that identifies them.
 *
 * Takes no Vocabulary identifier: Symbol bytes are not Vocabulary data, so the
 * Management check happens later, when a Change Set referencing the digest is
 * submitted (ADR 0008). Uploading the same bytes twice is a no-op.
 */
symbolRoutes.post("/", requireAuth, async (c) => {
  const body = new Uint8Array(await c.req.arrayBuffer());

  if (body.length === 0) {
    return c.json({ error: "No image data" }, 400);
  }
  if (body.length > MAX_SYMBOL_BYTES) {
    return c.json(
      {
        error: `Image is larger than ${Math.floor(MAX_SYMBOL_BYTES / (1024 * 1024))}MB`,
      },
      413,
    );
  }

  const type = sniffImageType(body);
  if (type === "svg") {
    return c.json({ error: "SVG images are not supported" }, 415);
  }
  if (!isStorableImageType(type)) {
    return c.json({ error: "Unsupported image format" }, 415);
  }

  const digest = symbolDigest(body);

  let supabase;
  try {
    supabase = createServiceSupabaseClient();
  } catch {
    return c.json({ error: "Symbol storage is not configured" }, 503);
  }

  const { error } = await supabase.storage.from(SYMBOL_BUCKET).upload(digest, body, {
    contentType: CONTENT_TYPE_BY_IMAGE_TYPE[type],
    cacheControl: IMMUTABLE_CACHE_SECONDS,
    upsert: false,
  });

  if (error && !isAlreadyStored(error as { message?: string; statusCode?: string })) {
    return c.json({ error: "Could not store the image" }, 502);
  }

  return c.json({ digest, url: symbolPublicUrl(SYMBOL_BUCKET, digest) });
});

/**
 * Resolve a digest to its bytes. Unauthenticated by design: the digest is the
 * read capability (ADR 0008). This redirects rather than proxying, so the
 * viewer still fetches from the CDN and we add no bytes to the hot path.
 */
symbolRoutes.get("/:digest", (c) => {
  const digest = c.req.param("digest");
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    return c.json({ error: "Not found" }, 404);
  }
  c.header("Cache-Control", `public, max-age=${IMMUTABLE_CACHE_SECONDS}, immutable`);
  return c.redirect(symbolPublicUrl(SYMBOL_BUCKET, digest), 302);
});
