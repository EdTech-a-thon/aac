import { Hono } from "hono";
import { createServiceSupabaseClient } from "../supabase.ts";
import { withDisplayName } from "../displayName.ts";

/**
 * Anonymous reads through a Share Link. The token is the capability, so this
 * is the one place that decides what a link exposes: it validates the token
 * and reads with the service role, which is why no table grants anon access.
 * See ADR 0010.
 */
export const sharedRoutes = new Hono();

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

  // Board Share Links arrive with their own scoping rules; until those exist,
  // a link this route cannot scope correctly exposes nothing.
  if (link.board_id !== null) return c.json(UNAVAILABLE, 404);

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

  const buttonsByBoardId: Record<string, Button[]> = {};
  for (const board of boards) buttonsByBoardId[board.id] = [];
  for (const button of (buttonsResult.data ?? []) as Button[]) {
    buttonsByBoardId[button.board_id]?.push(button);
  }

  return c.json({
    share: {
      kind: "vocabulary" as const,
      vocabulary: withDisplayName(vocabularyResult.data as { id: string; name: string }),
    },
    content: {
      boards: boards.map(withDisplayName),
      buttonsByBoardId,
      paletteColors: paletteResult.data ?? [],
      snippetInclusions: (inclusionsResult.data ?? []) as Inclusion[],
      // Unresolved Copy Actions are a Manager-only warning and are never
      // visible through a Share Link.
      unresolvedCopyActions: [],
    },
  });
});
