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
  kind?: "board" | "snippet";
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
  background_color: string | null;
  palette_color_id: string | null;
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

type SnippetInclusion = {
  id: string;
  host_id: string;
  snippet_id: string;
  origin_row: number;
  origin_col: number;
  created_at: string;
  updated_at: string;
};

type ManagerProfile = {
  id: string;
  email: string;
  name: string | null;
};

type RelationshipRow = {
  vocabulary_id: string;
  user_id: string;
  created_at: string;
  profiles: ManagerProfile | ManagerProfile[] | null;
};

function relationshipMembers(data: RelationshipRow[] | null) {
  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id,
      email: profile?.email ?? null,
      name: profile?.name ?? null,
      createdAt: row.created_at,
    };
  });
}

async function requireVocabularyManager(
  supabase: AuthVariables["supabase"],
  userId: string,
  vocabularyId: string,
) {
  const { data, error } = await supabase
    .from("vocabulary_managers")
    .select("user_id")
    .eq("vocabulary_id", vocabularyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: pgErrorMessage(error) };
  }
  if (!data) {
    return { ok: false as const, error: "Not a manager of this vocabulary" };
  }
  return { ok: true as const };
}

async function requireVocabularyCommunicator(
  supabase: AuthVariables["supabase"],
  userId: string,
  vocabularyId: string,
) {
  const { data, error } = await supabase
    .from("vocabulary_users")
    .select("user_id")
    .eq("vocabulary_id", vocabularyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: pgErrorMessage(error) };
  }
  if (!data) {
    return { ok: false as const, error: "Not a communicator of this vocabulary" };
  }
  return { ok: true as const };
}

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
  const userId = c.get("user").id;
  const { data, error } = await supabase
    .from("vocabularies")
    .select("id, name, created_at, updated_at, vocabulary_managers!inner(user_id)")
    .eq("vocabulary_managers.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  const vocabularies = (data ?? []).map((row) => {
    const { vocabulary_managers: _, ...vocabulary } = row as Vocabulary & {
      vocabulary_managers: unknown;
    };
    return withDisplayName(vocabulary);
  });

  return c.json({ vocabularies });
});

vocabularyRoutes.get("/using", async (c) => {
  const supabase = c.get("supabase");
  const userId = c.get("user").id;
  const { data, error } = await supabase
    .from("vocabularies")
    .select("id, name, created_at, updated_at, vocabulary_users!inner(user_id)")
    .eq("vocabulary_users.user_id", userId);

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  const vocabularies = (data ?? [])
    .map((row) => {
      const { vocabulary_users: _, ...vocabulary } = row as Vocabulary & {
        vocabulary_users: unknown;
      };
      return withDisplayName(vocabulary);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return c.json({ vocabularies });
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

vocabularyRoutes.get("/:id/live", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const usage = await requireVocabularyCommunicator(supabase, c.get("user").id, id);
  if (!usage.ok) {
    return c.json({ error: usage.error }, 404);
  }

  const vocabularyResult = await supabase
    .from("vocabularies")
    .select("id, name, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (vocabularyResult.error) {
    return c.json({ error: pgErrorMessage(vocabularyResult.error) }, 400);
  }
  if (!vocabularyResult.data) {
    return c.json({ error: "Vocabulary not found" }, 404);
  }

  const [boardsResult, paletteResult, revisionResult] = await Promise.all([
    supabase
      .from("boards")
      .select("id, vocabulary_id, name, width, height, kind, created_at, updated_at")
      .eq("vocabulary_id", id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("palette_colors")
      .select(
        "id, vocabulary_id, hex, name, description, position, created_at, updated_at",
      )
      .eq("vocabulary_id", id)
      .order("position", { ascending: true }),
    supabase.rpc("live_vocabulary_revision", { p_vocabulary_id: id }),
  ]);

  if (boardsResult.error) {
    return c.json({ error: pgErrorMessage(boardsResult.error) }, 400);
  }
  if (paletteResult.error) {
    return c.json({ error: pgErrorMessage(paletteResult.error) }, 400);
  }
  if (revisionResult.error) {
    return c.json({ error: pgErrorMessage(revisionResult.error) }, 400);
  }

  const boards = (boardsResult.data ?? []) as Board[];
  const boardIds = boards.map((board) => board.id);
  let buttons: Button[] = [];
  let snippetInclusions: SnippetInclusion[] = [];
  if (boardIds.length > 0) {
    const [buttonsResult, inclusionsResult] = await Promise.all([
      supabase
        .from("buttons")
        .select(
          "id, board_id, row_index, col_index, label, background_color, palette_color_id, action, symbol_digest, created_at, updated_at",
        )
        .in("board_id", boardIds)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("snippet_inclusions")
        .select(
          "id, host_id, snippet_id, origin_row, origin_col, created_at, updated_at",
        )
        .in("host_id", boardIds)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);
    if (buttonsResult.error) {
      return c.json({ error: pgErrorMessage(buttonsResult.error) }, 400);
    }
    if (inclusionsResult.error) {
      return c.json({ error: pgErrorMessage(inclusionsResult.error) }, 400);
    }
    buttons = (buttonsResult.data ?? []) as Button[];
    snippetInclusions = (inclusionsResult.data ?? []) as SnippetInclusion[];
  }

  const buttonsByBoard = new Map<string, Button[]>();
  for (const button of buttons) {
    const list = buttonsByBoard.get(button.board_id) ?? [];
    list.push(button);
    buttonsByBoard.set(button.board_id, list);
  }

  const revision =
    typeof revisionResult.data === "number"
      ? revisionResult.data
      : Number(revisionResult.data ?? 0);

  return c.json({
    snapshot: {
      ...withDisplayName(vocabularyResult.data as Vocabulary),
      revision,
      paletteColors: (paletteResult.data ?? []) as PaletteColor[],
      snippetInclusions,
      boards: boards.map((board) => ({
        ...withDisplayName(board),
        buttons: buttonsByBoard.get(board.id) ?? [],
      })),
    },
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
    .select("id, vocabulary_id, name, width, height, kind, created_at, updated_at")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

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

vocabularyRoutes.get("/:id/snippet-inclusions", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const boards = await supabase.from("boards").select("id").eq("vocabulary_id", id);
  if (boards.error) {
    return c.json({ error: pgErrorMessage(boards.error) }, 400);
  }
  const boardIds = (boards.data ?? []).map((board) => board.id);
  if (boardIds.length === 0) {
    return c.json({ snippetInclusions: [] });
  }

  const { data, error } = await supabase
    .from("snippet_inclusions")
    .select("id, host_id, snippet_id, origin_row, origin_col, created_at, updated_at")
    .in("host_id", boardIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({
    snippetInclusions: data as SnippetInclusion[],
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
      "id, board_id, row_index, col_index, label, background_color, palette_color_id, action, symbol_digest, created_at, updated_at",
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

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
  const managed = await requireVocabularyManager(supabase, c.get("user").id, id);
  if (!managed.ok) {
    return c.json({ error: managed.error }, 400);
  }
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

  const changeSets = (data ?? []) as ChangeSet[];
  const authorIds = [
    ...new Set(
      changeSets
        .map((cs) => cs.author_id)
        .filter((authorId): authorId is string => Boolean(authorId)),
    ),
  ];

  const profileById = new Map<string, { email: string | null; name: string | null }>();
  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", authorIds);

    if (profilesError) {
      return c.json({ error: pgErrorMessage(profilesError) }, 400);
    }

    for (const profile of (profiles ?? []) as {
      id: string;
      email: string | null;
      name: string | null;
    }[]) {
      profileById.set(profile.id, {
        email: profile.email ?? null,
        name: profile.name ?? null,
      });
    }
  }

  return c.json({
    changeSets: changeSets.map((cs) => {
      const profile = cs.author_id ? profileById.get(cs.author_id) : undefined;
      return {
        ...cs,
        author_name: profile?.name ?? null,
        author_email: profile?.email ?? null,
      };
    }),
  });
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
  const managed = await requireVocabularyManager(supabase, c.get("user").id, id);
  if (!managed.ok) {
    return c.json({ error: managed.error }, 400);
  }

  const { data, error } = await supabase
    .from("vocabulary_managers")
    .select("vocabulary_id, user_id, created_at, profiles(id, email, name)")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ managers: relationshipMembers(data as RelationshipRow[]) });
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

  return c.json({ managers: relationshipMembers(data as RelationshipRow[]) }, 201);
});

vocabularyRoutes.get("/:id/communicators", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const managed = await requireVocabularyManager(supabase, c.get("user").id, id);
  if (!managed.ok) {
    return c.json({ error: managed.error }, 400);
  }

  const { data, error } = await supabase
    .from("vocabulary_users")
    .select("vocabulary_id, user_id, created_at, profiles(id, email, name)")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ communicators: relationshipMembers(data as RelationshipRow[]) });
});

vocabularyRoutes.post("/:id/communicators", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const body = await c.req.json<{ email?: string }>().catch((): { email?: string } => ({}));
  const email = body.email?.trim();

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const { error } = await supabase.rpc("add_vocabulary_communicator", {
    p_vocabulary_id: id,
    p_email: email,
  });

  if (error) {
    const message = pgErrorMessage(error);
    const status = message.toLowerCase().includes("no user found") ? 404 : 400;
    return c.json({ error: message }, status);
  }

  const { data, error: listError } = await supabase
    .from("vocabulary_users")
    .select("vocabulary_id, user_id, created_at, profiles(id, email, name)")
    .eq("vocabulary_id", id)
    .order("created_at", { ascending: true });

  if (listError) {
    return c.json({ error: pgErrorMessage(listError) }, 400);
  }

  return c.json({ communicators: relationshipMembers(data as RelationshipRow[]) }, 201);
});

vocabularyRoutes.delete("/:id/communicators/:userId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const userId = c.req.param("userId");

  const { error } = await supabase.rpc("remove_vocabulary_communicator", {
    p_vocabulary_id: id,
    p_user_id: userId,
  });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ ok: true });
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
