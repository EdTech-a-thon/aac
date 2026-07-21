import { createClient } from "@supabase/supabase-js";
import { createApp } from "../app.ts";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for API integration tests`);
  }
  return value;
}

export function testApp() {
  return createApp();
}

export async function createTestUser() {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "test-password-changeset-123";
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? "Failed to create test user");
  }

  return {
    email,
    password,
    userId: data.user.id,
    accessToken: data.session.access_token,
  };
}

export async function apiJson<T>(
  app: ReturnType<typeof createApp>,
  path: string,
  options: {
    method?: string;
    accessToken?: string;
    body?: unknown;
  } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const res = await app.request(path, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: res.status, body };
}
