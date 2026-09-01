import { Hono } from "hono";
import { createServiceSupabaseClient } from "../supabase.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";
import {
  prepareBoardCopy,
  remapVocabularySnapshot,
  type VocabularyCopySnapshot,
} from "../copyVocabulary.js";
import { withDisplayName } from "../displayName.js";
import { scopeBoardShare } from "../shareScope.js";

/**
 * Anonymous reads through a Share Link. The token is the capability, so this
 * is the one place that decides what a link exposes: it validates the token
 * and reads with the service role, which is why no table grants anon access.
 * See ADR 0010.
 */
export const sharedRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * Revoked, deleted, and never-existed all look the same from outside. A link
 * must not be usable to discover whether a Vocabulary or Board exists.
 */
const UNAVAILABLE = { error: "This link isn't available" };

type ShareLinkRow = {
  vocabulary_id: string;
  board_id: string | null;
};

type Grid = {
  id: string;
  vocabulary_id: string;
  name: string;
  width: number;
  height: number;
  kind: "board" | "snippet";
  created_at: string;
  updated_at: string;
};

type Button = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string | null;
  palette_color_id: string | null;
  action: Record<string, unknown> | null;
  symbol_digest: string | null;
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

type Inclusion = {
  id: string;
  host_id: string;
  snippet_id: string;
  origin_row: number;
  origin_col: number;
  created_at: string;
  updated_at: string;
};

/** A token is 64 lowercase hex characters; anything else never reaches the table. */
function looksLikeToken(token: string) {
  return /^[0-9a-f]{64}$/.test(token);
}

sharedRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");
  if (!looksLikeToken(token)) return c.json(UNAVAILABLE, 404);

  const supabase = createServiceSupabaseClient();
  const linkResult = await supabase
    .from("share_links")
    .select("vocabulary_id, board_id")
    .eq("token", token)
    .maybeSingle();
  if (linkResult.error || !linkResult.data) return c.json(UNAVAILABLE, 404);
  const link = linkResult.data as ShareLinkRow;

  const vocabularyResult = await supabase
    .from("vocabularies")
    .select("id, name")
    .eq("id", link.vocabulary_id)
    .maybeSingle();
  if (vocabularyResult.error || !vocabularyResult.data) return c.json(UNAVAILABLE, 404);

  const boardsResult = await supabase
    .from("boards")
    .select("id, vocabulary_id, name, width, height, kind, created_at, updated_at")
    .eq("vocabulary_id", link.vocabulary_id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (boardsResult.error) return c.json(UNAVAILABLE, 404);
  const boards = (boardsResult.data ?? []) as Grid[];
  const boardIds = boards.map((board) => board.id);

  const [paletteResult, buttonsResult, inclusionsResult] = await Promise.all([
    supabase
      .from("palette_colors")
      .select("id, vocabulary_id, hex, name, description, position, created_at, updated_at")
      .eq("vocabulary_id", link.vocabulary_id)
      .order("position", { ascending: true }),
    boardIds.length
      ? supabase
          .from("buttons")
          .select(
            "id, board_id, row_index, col_index, label, background_color, palette_color_id, action, symbol_digest, created_at, updated_at",
          )
          .in("board_id", boardIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    boardIds.length
      ? supabase
          .from("snippet_inclusions")
          .select("id, host_id, snippet_id, origin_row, origin_col, created_at, updated_at")
          .in("host_id", boardIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paletteResult.error || buttonsResult.error || inclusionsResult.error) {
    return c.json(UNAVAILABLE, 404);
  }

  let inScopeBoards = boards;
  let inScopeButtons = (buttonsResult.data ?? []) as Button[];
  let inScopeInclusions = (inclusionsResult.data ?? []) as Inclusion[];
  let inScopeColors = (paletteResult.data ?? []) as PaletteColor[];
  let sharedBoard: Grid | null = null;

  if (link.board_id !== null) {
    // A Board Share Link exposes the Board and what it needs to draw itself,
    // never the rest of the Vocabulary. See ADR 0010.
    const scoped = scopeBoardShare({
      boards,
      buttons: inScopeButtons,
      snippetInclusions: inScopeInclusions,
      paletteColors: inScopeColors,
      boardId: link.board_id,
    });
    if (!scoped) return c.json(UNAVAILABLE, 404);
    sharedBoard = scoped.boards.find((board) => board.id === link.board_id) ?? null;
    if (!sharedBoard) return c.json(UNAVAILABLE, 404);
    inScopeBoards = scoped.boards;
    inScopeButtons = scoped.buttons;
    inScopeInclusions = scoped.snippetInclusions;
    inScopeColors = scoped.paletteColors;
  }

  const buttonsByBoardId: Record<string, Button[]> = {};
  for (const board of inScopeBoards) buttonsByBoardId[board.id] = [];
  for (const button of inScopeButtons) {
    buttonsByBoardId[button.board_id]?.push(button);
  }

  return c.json({
    share: {
      kind: sharedBoard ? ("board" as const) : ("vocabulary" as const),
      vocabulary: withDisplayName(vocabularyResult.data as { id: string; name: string }),
      board: sharedBoard ? withDisplayName(sharedBoard) : null,
    },
    content: {
      boards: inScopeBoards.map(withDisplayName),
      buttonsByBoardId,
      paletteColors: inScopeColors,
      snippetInclusions: inScopeInclusions,
      // Unresolved Copy Actions are a Manager-only warning and are never
      // visible through a Share Link.
      unresolvedCopyActions: [],
    },
  });
});

/**
 * Keep what a Share Link showed you. The snapshot is what the Visitor could
 * see, their own edits folded in, and it becomes the Initial Snapshot of a
 * Vocabulary they alone manage. The source is not touched. See ADR 0011.
 */
sharedRoutes.post("/:token/save", requireAuth, async (c) => {
  const token = c.req.param("token");
  if (!looksLikeToken(token)) return c.json(UNAVAILABLE, 404);

  const service = createServiceSupabaseClient();
  const linkResult = await service
    .from("share_links")
    .select("vocabulary_id, board_id")
    .eq("token", token)
    .maybeSingle();
  if (linkResult.error || !linkResult.data) return c.json(UNAVAILABLE, 404);
  const link = linkResult.data as ShareLinkRow;

  // Keeping a shared Board chooses a destination, which is its own route.
  if (link.board_id !== null) return c.json(UNAVAILABLE, 404);

  const body = await c.req
    .json<{ name?: string; snapshot?: VocabularyCopySnapshot }>()
    .catch((): { name?: string; snapshot?: VocabularyCopySnapshot } => ({}));
  if (!body.snapshot) return c.json({ error: "snapshot is required" }, 400);

  const copied = remapVocabularySnapshot(body.snapshot);
  const { data, error } = await c.get("supabase").rpc(
    "create_vocabulary_from_snapshot",
    {
      p_name: typeof body.name === "string" ? body.name : "",
      p_initial_snapshot: copied.initialSnapshot,
      p_mutations: copied.mutations,
    },
  );
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ vocabulary: withDisplayName(data as { id: string; name: string }) }, 201);
});

/**
 * Keep a Board that arrived through a Share Link. Into a brand-new Vocabulary
 * it lands with its Palette Color bindings intact — there is no incumbent
 * Palette to confuse it with. Into a Vocabulary the saver already manages it
 * is an ordinary Board Copy across Vocabularies, freezing those bindings to
 * custom hexes and raising Unresolved Copy Actions for Actions it must clear.
 */
sharedRoutes.post("/:token/save-board", requireAuth, async (c) => {
  const token = c.req.param("token");
  if (!looksLikeToken(token)) return c.json(UNAVAILABLE, 404);

  const service = createServiceSupabaseClient();
  const linkResult = await service
    .from("share_links")
    .select("vocabulary_id, board_id")
    .eq("token", token)
    .maybeSingle();
  if (linkResult.error || !linkResult.data) return c.json(UNAVAILABLE, 404);
  const link = linkResult.data as ShareLinkRow;
  if (link.board_id === null) return c.json(UNAVAILABLE, 404);

  type SaveBoardBody = {
    destinationVocabularyId?: string;
    name?: string;
    snapshot?: VocabularyCopySnapshot;
  };
  const body = await c.req
    .json<SaveBoardBody>()
    .catch((): SaveBoardBody => ({}));
  if (!body.snapshot) return c.json({ error: "snapshot is required" }, 400);

  const supabase = c.get("supabase");
  const sourceBoard = body.snapshot.boards.find((board) => board.id === link.board_id);
  const name = typeof body.name === "string" && body.name
    ? body.name
    : (sourceBoard?.name ?? "");

  // No destination named means a Vocabulary of their own, built around this
  // Board. Its Palette Colors come across as Palette Colors, bindings intact.
  if (!body.destinationVocabularyId) {
    const copied = remapVocabularySnapshot(body.snapshot);
    const { data, error } = await supabase.rpc("create_vocabulary_from_snapshot", {
      p_name: name,
      p_initial_snapshot: copied.initialSnapshot,
      p_mutations: copied.mutations,
    });
    if (error) return c.json({ error: error.message }, 400);
    return c.json(
      { vocabulary: withDisplayName(data as { id: string; name: string }) },
      201,
    );
  }

  let prepared;
  try {
    prepared = prepareBoardCopy(
      body.snapshot,
      link.vocabulary_id,
      body.destinationVocabularyId,
      link.board_id,
      name,
    );
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Could not keep this Board" },
      400,
    );
  }

  const { error } = await supabase.rpc("save_shared_board", {
    p_destination_vocabulary_id: body.destinationVocabularyId,
    p_mutations: prepared.mutations,
    p_warnings: prepared.warnings,
    p_summary: `Kept shared Board “${name || "Untitled"}”`,
  });
  if (error) return c.json({ error: error.message }, 400);
  return c.json(
    {
      vocabularyId: body.destinationVocabularyId,
      boardId: prepared.boardId,
      warnings: prepared.warnings,
    },
    201,
  );
});
