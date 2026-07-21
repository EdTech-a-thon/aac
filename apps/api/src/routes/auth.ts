import type { Session, User } from "@supabase/supabase-js";
import { Hono } from "hono";
import { createSupabaseClient } from "../supabase.ts";

type AuthBody = {
  email?: string;
  password?: string;
};

function parseAuthBody(body: AuthBody) {
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return { error: "Email and password are required" } as const;
  }

  return { email, password } as const;
}

function authResponse(session: Session, user: User) {
  return {
    user: {
      id: user.id,
      email: user.email,
    },
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    },
  };
}

export const authRoutes = new Hono();

authRoutes.post("/register", async (c) => {
  const body = await c.req.json<AuthBody>();
  const parsed = parseAuthBody(body);

  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    const status = error.message.toLowerCase().includes("already registered")
      ? 409
      : 400;
    return c.json({ error: error.message }, status);
  }

  if (!data.user) {
    return c.json({ error: "Registration failed" }, 400);
  }

  if (!data.session) {
    return c.json(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        message: "Check your email to confirm your account before signing in.",
      },
      201,
    );
  }

  return c.json(authResponse(data.session, data.user), 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<AuthBody>();
  const parsed = parseAuthBody(body);

  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    const status = error.message
      .toLowerCase()
      .includes("invalid login credentials")
      ? 401
      : 400;
    return c.json({ error: error.message }, status);
  }

  if (!data.session || !data.user) {
    return c.json({ error: "Login failed" }, 401);
  }

  return c.json(authResponse(data.session, data.user));
});
