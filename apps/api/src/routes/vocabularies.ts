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

type Button = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string;
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

const DEFAULT_BOARD_WIDTH = 4;
const DEFAULT_BOARD_HEIGHT = 4;

function displayName(name: string | null | undefined) {
  return name && name.trim() ? name : "Untitled";
}

function withDisplayName<T extends { name: string }>(row: T) {
  return { ...row, displayName: displayName(row.name) };
}

function pgErrorMessage(error: { message: string } | null) {
  return error?.message ?? "Request failed";
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return null;
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
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
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

vocabularyRoutes.post("/:id/boards", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const body = await c
    .req.json<{ name?: string; width?: number; height?: number }>()
    .catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";

  let width = DEFAULT_BOARD_WIDTH;
  if (body.width !== undefined) {
    const parsed = parsePositiveInt(body.width);
    if (parsed === null) {
      return c.json({ error: "width must be an integer ≥ 1" }, 400);
    }
    width = parsed;
  }

  let height = DEFAULT_BOARD_HEIGHT;
  if (body.height !== undefined) {
    const parsed = parsePositiveInt(body.height);
    if (parsed === null) {
      return c.json({ error: "height must be an integer ≥ 1" }, 400);
    }
    height = parsed;
  }

  const { data, error } = await supabase
    .from("boards")
    .insert({
      vocabulary_id: id,
      name,
      width,
      height,
    })
    .select("id, vocabulary_id, name, width, height, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Vocabulary not found" }, 404);
  }

  return c.json({ board: withDisplayName(data as Board) }, 201);
});

vocabularyRoutes.patch("/:id/boards/:boardId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const boardId = c.req.param("boardId");
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));

  if (typeof body.name !== "string") {
    return c.json({ error: "name is required" }, 400);
  }

  const { data, error } = await supabase
    .from("boards")
    .update({ name: body.name })
    .eq("id", boardId)
    .eq("vocabulary_id", id)
    .select("id, vocabulary_id, name, width, height, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json({ board: withDisplayName(data as Board) });
});

vocabularyRoutes.delete("/:id/boards/:boardId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const boardId = c.req.param("boardId");

  const { data, error } = await supabase
    .from("boards")
    .delete()
    .eq("id", boardId)
    .eq("vocabulary_id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json({ ok: true });
});

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
    .select("id, board_id, row_index, col_index, label, background_color, created_at, updated_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  return c.json({ buttons: data as Button[] });
});

vocabularyRoutes.post("/:id/boards/:boardId/buttons", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const boardId = c.req.param("boardId");
  const body = await c
    .req.json<{
      row_index?: number;
      col_index?: number;
      label?: string;
      background_color?: string;
    }>()
    .catch(() => ({}));

  const row =
    typeof body.row_index === "number" && Number.isInteger(body.row_index)
      ? body.row_index
      : null;
  const col =
    typeof body.col_index === "number" && Number.isInteger(body.col_index)
      ? body.col_index
      : null;

  if (row === null || row < 0) {
    return c.json({ error: "row_index must be an integer ≥ 0" }, 400);
  }
  if (col === null || col < 0) {
    return c.json({ error: "col_index must be an integer ≥ 0" }, 400);
  }

  const label = typeof body.label === "string" ? body.label : "";
  let backgroundColor = "#ffffff";
  if (body.background_color !== undefined) {
    if (
      typeof body.background_color !== "string" ||
      !/^#[0-9A-Fa-f]{6}$/.test(body.background_color)
    ) {
      return c.json({ error: "background_color must be a hex color like #RRGGBB" }, 400);
    }
    backgroundColor = body.background_color.toLowerCase();
  }

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
    .insert({
      board_id: boardId,
      row_index: row,
      col_index: col,
      label,
      background_color: backgroundColor,
    })
    .select(
      "id, board_id, row_index, col_index, label, background_color, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Failed to create button" }, 400);
  }

  return c.json({ button: data as Button }, 201);
});

vocabularyRoutes.patch("/:id/boards/:boardId/buttons/:buttonId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const boardId = c.req.param("boardId");
  const buttonId = c.req.param("buttonId");
  const body = await c
    .req.json<{
      label?: string;
      row_index?: number;
      col_index?: number;
      background_color?: string;
    }>()
    .catch(() => ({}));

  const updates: {
    label?: string;
    row_index?: number;
    col_index?: number;
    background_color?: string;
  } = {};

  if (body.label !== undefined) {
    if (typeof body.label !== "string") {
      return c.json({ error: "label must be a string" }, 400);
    }
    updates.label = body.label;
  }

  if (body.row_index !== undefined) {
    if (typeof body.row_index !== "number" || !Number.isInteger(body.row_index)) {
      return c.json({ error: "row_index must be an integer" }, 400);
    }
    updates.row_index = body.row_index;
  }

  if (body.col_index !== undefined) {
    if (typeof body.col_index !== "number" || !Number.isInteger(body.col_index)) {
      return c.json({ error: "col_index must be an integer" }, 400);
    }
    updates.col_index = body.col_index;
  }

  if (body.background_color !== undefined) {
    if (
      typeof body.background_color !== "string" ||
      !/^#[0-9A-Fa-f]{6}$/.test(body.background_color)
    ) {
      return c.json({ error: "background_color must be a hex color like #RRGGBB" }, 400);
    }
    updates.background_color = body.background_color.toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No updates provided" }, 400);
  }

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
    .update(updates)
    .eq("id", buttonId)
    .eq("board_id", boardId)
    .select(
      "id, board_id, row_index, col_index, label, background_color, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Button not found" }, 404);
  }

  return c.json({ button: data as Button });
});

vocabularyRoutes.delete("/:id/boards/:boardId/buttons/:buttonId", async (c) => {
  const supabase = c.get("supabase");
  const id = c.req.param("id");
  const boardId = c.req.param("boardId");
  const buttonId = c.req.param("buttonId");

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
    .delete()
    .eq("id", buttonId)
    .eq("board_id", boardId)
    .select("id")
    .maybeSingle();

  if (error) {
    return c.json({ error: pgErrorMessage(error) }, 400);
  }

  if (!data) {
    return c.json({ error: "Button not found" }, 404);
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
