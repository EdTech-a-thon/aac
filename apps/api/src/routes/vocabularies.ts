import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "../middleware/auth.ts";

type Vocabulary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type Board = {
  id: string;
  vocabulary_id: string;
  name: string;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
};

type ButtonAction =
  | { kind: "insert_phrase"; phrase: string }
  | { kind: "speak_immediately"; phrase: string }
  | { kind: "open_board"; board_id: string }
  | {
      kind: "play_youtube_clip";
      video_id: string;
      start: number;
      end: number;
    }
  | { kind: "clear_message_bar" }
  | { kind: "backspace" };

type Button = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string;
  action: ButtonAction | null;
  created_at: string;
  updated_at: string;
};

type PaletteColor = {
  id: string;
  vocabulary_id: string;
  hex: string;
  name: string;
  description: string;
  position: number;
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

type ChangeSet = {
  id: string;
  vocabulary_id: string;
  author_id: string | null;
  status: "applied" | "suggested";
  mutations: unknown;
  applied_seq: number | null;
  applied_at: string | null;
  created_at: string;
};

const CHANGE_SET_ONLY_MESSAGE =
  "Boards and buttons can only be changed by submitting a Change Set";

function displayName(name: string | null | undefined) {
  return name && name.trim() ? name : "Untitled";
}

function withDisplayName<T extends { name: string }>(row: T) {
  return { ...row, displayName: displayName(row.name) };
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
    vocabularies: (data as Vocabulary[]).map(withDisplayName),
  });
});

vocabularyRoutes.post("/", async (c) => {
  const supabase = c.get("supabase");
  const body = await c.req.json<{ name?: string }>().catch((): { name?: string } => ({}));
  const name = typeof body.name === "string" ? body.name : "";

  const { data, error } = await supabase.rpc("create_vocabulary", {
    p_name: name,
  });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json(
    {
      vocabulary: withDisplayName(data as Vocabulary),
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

  return c.json({
    vocabulary: withDisplayName(data as Vocabulary),
  });
});

vocabularyRoutes.patch("/:id", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string }>().catch((): { name?: string } => ({}));

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

  return c.json({
    vocabulary: withDisplayName(data as Vocabulary),
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

vocabularyRoutes.get("/:id/boards", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("boards")
    .select("id, vocabulary_id, name, width, height, created_at, updated_at")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({
    boards: (data as Board[]).map(withDisplayName),
  });
});

vocabularyRoutes.get("/:id/palette-colors", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("palette_colors")
    .select(
      "id, vocabulary_id, hex, name, description, position, created_at, updated_at",
    )
    .eq("vocabulary_id", id)
    .order("position", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({
    paletteColors: data as PaletteColor[],
  });
});

vocabularyRoutes.post("/:id/boards", (c) =>
  c.json({ error: CHANGE_SET_ONLY_MESSAGE }, 410),
);

vocabularyRoutes.patch("/:id/boards/:boardId", (c) =>
  c.json({ error: CHANGE_SET_ONLY_MESSAGE }, 410),
);

vocabularyRoutes.delete("/:id/boards/:boardId", (c) =>
  c.json({ error: CHANGE_SET_ONLY_MESSAGE }, 410),
);

vocabularyRoutes.get("/:id/boards/:boardId/buttons", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const boardId = c.req.param("boardId");

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .eq("vocabulary_id", id)
    .maybeSingle();

  if (boardError) {
    return c.json({ error: pgErrorMessage(boardError) }, 400);
  }

  if (!board) {
    return c.json({ error: "Board not found" }, 404);
  }

  const { data, error } = await supabase
    .from("buttons")
    .select(
      "id, board_id, row_index, col_index, label, background_color, action, created_at, updated_at",
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ buttons: data as Button[] });
});

vocabularyRoutes.post("/:id/boards/:boardId/buttons", (c) =>
  c.json({ error: CHANGE_SET_ONLY_MESSAGE }, 410),
);

vocabularyRoutes.patch("/:id/boards/:boardId/buttons/:buttonId", (c) =>
  c.json({ error: CHANGE_SET_ONLY_MESSAGE }, 410),
);

vocabularyRoutes.delete("/:id/boards/:boardId/buttons/:buttonId", (c) =>
  c.json({ error: CHANGE_SET_ONLY_MESSAGE }, 410),
);

vocabularyRoutes.get("/:id/change-sets", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const status = c.req.query("status");

  let query = supabase
    .from("change_sets")
    .select(
      "id, vocabulary_id, author_id, status, mutations, applied_seq, applied_at, created_at",
    )
    .eq("vocabulary_id", id);

  if (status === "applied") {
    query = query.eq("status", "applied").order("applied_seq", { ascending: true });
  } else if (status === "suggested") {
    query = query.eq("status", "suggested").order("created_at", { ascending: true });
  } else {
    query = query
      .order("status", { ascending: true })
      .order("applied_seq", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ changeSets: data as ChangeSet[] });
});

vocabularyRoutes.post("/:id/change-sets", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const body = await c
    .req.json<{ status?: string; mutations?: unknown }>()
    .catch((): { status?: string; mutations?: unknown } => ({}));

  const status = body.status;
  if (status !== "applied" && status !== "suggested") {
    return c.json({ error: "status must be applied or suggested" }, 400);
  }

  if (!Array.isArray(body.mutations)) {
    return c.json({ error: "mutations must be an array" }, 400);
  }

  const { data, error } = await supabase.rpc("submit_change_set", {
    p_vocabulary_id: id,
    p_status: status,
    p_mutations: body.mutations,
  });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ changeSet: data as ChangeSet }, 201);
});

vocabularyRoutes.post("/:id/change-sets/:changeSetId/apply", async (c) => {
  const supabase = c.get("supabase");
  const changeSetId = c.req.param("changeSetId");

  const { data, error } = await supabase.rpc("apply_suggested_change_set", {
    p_change_set_id: changeSetId,
  });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ changeSet: data as ChangeSet });
});

vocabularyRoutes.delete("/:id/change-sets/:changeSetId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const changeSetId = c.req.param("changeSetId");

  const { data, error } = await supabase
    .from("change_sets")
    .delete()
    .eq("id", changeSetId)
    .eq("vocabulary_id", id)
    .eq("status", "suggested")
    .select("id")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Suggested Change Set not found" }, 404);
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
  const body = await c.req.json<{ email?: string }>().catch((): { email?: string } => ({}));
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
