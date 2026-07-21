import type { Session, User } from "@supabase/supabase-js";
import { Hono } from "hono";
import { isAllowedRedirectUrl } from "../corsOrigins.ts";
import { createSupabaseClient } from "../supabase.ts";

type AuthBody = {
  email?: string;
  password?: string;
  name?: string;
  emailRedirectTo?: string;
};

type AuthCredentials =
  | { error: string }
  | { email: string; password: string };

type RegisterCredentials =
  | { error: string }
  | { email: string; password: string; name: string; emailRedirectTo: string };

function parseCredentials(body: AuthBody): AuthCredentials {
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  return { email, password };
}

function parseRegisterBody(body: AuthBody): RegisterCredentials {
  const credentials = parseCredentials(body);
  if ("error" in credentials) {
    return credentials;
  }

  const name = body.name?.trim();
  if (!name) {
    return { error: "Name is required" };
  }

  const emailRedirectTo = body.emailRedirectTo?.trim();
  if (!emailRedirectTo) {
    return { error: "emailRedirectTo is required" };
  }

  if (!isAllowedRedirectUrl(emailRedirectTo)) {
    return { error: "emailRedirectTo is not an allowed origin" };
  }

  return {
    email: credentials.email,
    password: credentials.password,
    name,
    emailRedirectTo,
  };
}

function authUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null,
  };
}

function authResponse(session: Session, user: User) {
  return {
    user: authUser(user),
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
  const parsed = parseRegisterBody(body);

  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: {
        name: parsed.name,
      },
      emailRedirectTo: parsed.emailRedirectTo,
    },
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
        user: authUser(data.user),
        message: "Check your email to confirm your account before signing in.",
      },
      201,
    );
  }

  return c.json(authResponse(data.session, data.user), 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<AuthBody>();
  const parsed = parseCredentials(body);

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
