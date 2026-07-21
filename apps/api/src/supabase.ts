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
