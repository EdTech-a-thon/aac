import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "../middleware/auth.ts";

type Vocabulary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type ManagerProfile = {
  id: string;
  email: string;
  name: string | null;
};

type ManagerRow = {
  vocabulary_id: string;
  user_id: string;
  created_at: string;
  profiles: ManagerProfile | ManagerProfile[] | null;
};

function displayName(name: string | null | undefined) {
  return name && name.trim() ? name : "Untitled";
}

function pgErrorMessage(error: { message: string } | null) {
  return error?.message ?? "Request failed";
}

export const vocabularyRoutes = new Hono<{ Variables: AuthVariables }>();

vocabularyRoutes.use("*", requireAuth);

vocabularyRoutes.get("/", async (c) => {
  const supabase = c.get("supabase");
  const { data, error } = await supabase
    .from("vocabularies")
    .select("id, name, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({
    vocabularies: (data as Vocabulary[]).map((v) => ({
      ...v,
      displayName: displayName(v.name),
    })),
  });
});

vocabularyRoutes.post("/", async (c) => {
  const supabase = c.get("supabase");
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";

  const { data, error } = await supabase.rpc("create_vocabulary", {
    p_name: name,
  });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  const vocabulary = data as Vocabulary;
  return c.json(
    {
      vocabulary: {
        ...vocabulary,
        displayName: displayName(vocabulary.name),
      },
    },
    201,
  );
});

vocabularyRoutes.get("/:id", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("vocabularies")
    .select("id, name, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Vocabulary not found" }, 404);
  }

  const vocabulary = data as Vocabulary;
  return c.json({
    vocabulary: {
      ...vocabulary,
      displayName: displayName(vocabulary.name),
    },
  });
});

vocabularyRoutes.patch("/:id", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));

  if (typeof body.name !== "string") {
    return c.json({ error: "name is required" }, 400);
  }

  const { data, error } = await supabase
    .from("vocabularies")
    .update({ name: body.name })
    .eq("id", id)
    .select("id, name, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Vocabulary not found" }, 404);
  }

  const vocabulary = data as Vocabulary;
  return c.json({
    vocabulary: {
      ...vocabulary,
      displayName: displayName(vocabulary.name),
    },
  });
});

vocabularyRoutes.delete("/:id", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("vocabularies")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Vocabulary not found" }, 404);
  }

  return c.json({ ok: true });
});

vocabularyRoutes.get("/:id/managers", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("vocabulary_managers")
    .select("vocabulary_id, user_id, created_at, profiles(id, email, name)")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  const managers = (data as ManagerRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id,
      email: profile?.email ?? null,
      name: profile?.name ?? null,
      createdAt: row.created_at,
    };
  });

  return c.json({ managers });
});

vocabularyRoutes.post("/:id/managers", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const body = await c.req.json<{ email?: string }>().catch(() => ({}));
  const email = body.email?.trim();

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const { error } = await supabase.rpc("add_vocabulary_manager", {
    p_vocabulary_id: id,
    p_email: email,
  });

  if (error) {
    const message = pgErrorMessage(error);
    const status = message.toLowerCase().includes("no user found") ? 404 : 400;
    return c.json({ error: message }, status);
  }

  const { data, error: listError } = await supabase
    .from("vocabulary_managers")
    .select("vocabulary_id, user_id, created_at, profiles(id, email, name)")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true });

  if (listError) {
    return c.json({ error: pgErrorMessage(listError) }, 400);
  }

  const managers = (data as ManagerRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id,
      email: profile?.email ?? null,
      name: profile?.name ?? null,
      createdAt: row.created_at,
    };
  });

  return c.json({ managers }, 201);
});

vocabularyRoutes.delete("/:id/managers/:userId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const userId = c.req.param("userId");

  const { error } = await supabase.rpc("remove_vocabulary_manager", {
    p_vocabulary_id: id,
    p_user_id: userId,
  });

  if (error) {
    const message = pgErrorMessage(error);
    const status = message.toLowerCase().includes("at least one manager")
      ? 409
      : 400;
    return c.json({ error: message }, status);
  }

  return c.json({ ok: true });
});
