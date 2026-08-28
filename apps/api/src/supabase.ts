import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  }

  return { url, anonKey };
}

export function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = supabaseConfig();

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Client scoped to the caller's JWT so RLS policies apply. */
export function createUserSupabaseClient(accessToken: string): SupabaseClient {
  const { url, anonKey } = supabaseConfig();

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Service-role client, bypassing RLS. Used only to write Symbol bytes into the
 * public Symbol bucket, so that clients cannot write objects directly and
 * upload validation cannot be bypassed.
 */
export function createServiceSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to store Symbols",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Bytes are public-read and immutable, so the digest alone addresses them. */
export function symbolPublicUrl(bucket: string, digest: string): string {
  const url = process.env.SUPABASE_URL ?? "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${digest}`;
}
