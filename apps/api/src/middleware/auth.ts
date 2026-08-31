import type { User } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import { createUserSupabaseClient } from "../supabase.ts";

export type AuthVariables = {
  accessToken: string;
  user: User;
  supabase: ReturnType<typeof createUserSupabaseClient>;
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const accessToken = header.slice("Bearer ".length).trim();
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const supabase = createUserSupabaseClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("accessToken", accessToken);
    c.set("user", data.user);
    c.set("supabase", supabase);
    await next();
  },
);

/**
 * Who is calling, when that may be nobody.
 *
 * The Gallery is anonymous but not indifferent to identity: a signed-in visitor
 * sees whether they have already endorsed, and a Report names its reporter when
 * there is one. A bad or expired token is treated as no token rather than as an
 * error, because nothing here needs an account.
 */
export async function optionalUserId(
  authorization: string | undefined,
): Promise<string | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) return null;

  try {
    const supabase = createUserSupabaseClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
