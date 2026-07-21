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
