import type { SupabaseClient } from "@supabase/supabase-js";
import type { VocabularyCopySnapshot } from "./copyVocabulary.ts";

export type SnapshotGrid = {
  id: string;
  vocabulary_id: string;
  name: string;
  width: number;
  height: number;
  kind: "board" | "snippet";
  created_at: string;
  updated_at: string;
};

export type SnapshotButton = {
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

export type SnapshotPaletteColor = {
  id: string;
  vocabulary_id: string;
  hex: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type SnapshotInclusion = {
  id: string;
  host_id: string;
  snippet_id: string;
  origin_row: number;
  origin_col: number;
  created_at: string;
  updated_at: string;
};

/**
 * A Vocabulary's full visible state, every column included.
 *
 * A Publication Version stores this rather than the leaner copy shape, so one
 * stored snapshot serves both jobs: rendering the frozen Vocabulary to a
 * Visitor, and being copied into an account. It is a superset of
 * VocabularyCopySnapshot, so the copy path consumes it unchanged.
 */
export type FullVocabularySnapshot = VocabularyCopySnapshot & {
  boards: SnapshotGrid[];
  buttons: SnapshotButton[];
  palette_colors: SnapshotPaletteColor[];
  snippet_inclusions: SnapshotInclusion[];
};

const GRID_COLUMNS =
  "id, vocabulary_id, name, width, height, kind, created_at, updated_at";
const BUTTON_COLUMNS =
  "id, board_id, row_index, col_index, label, background_color, palette_color_id, action, symbol_digest, created_at, updated_at";
const PALETTE_COLUMNS =
  "id, vocabulary_id, hex, name, description, position, created_at, updated_at";
const INCLUSION_COLUMNS =
  "id, host_id, snippet_id, origin_row, origin_col, created_at, updated_at";

/** Reads the live Vocabulary — never staged edits, which are not part of it. */
export async function loadFullVocabularySnapshot(
  supabase: SupabaseClient,
  vocabularyId: string,
): Promise<{ snapshot?: FullVocabularySnapshot; error?: string }> {
  const boardsResult = await supabase
    .from("boards")
    .select(GRID_COLUMNS)
    .eq("vocabulary_id", vocabularyId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (boardsResult.error) return { error: boardsResult.error.message };

  const boards = (boardsResult.data ?? []) as SnapshotGrid[];
  const boardIds = boards.map((board) => board.id);

  const [paletteResult, buttonsResult, inclusionsResult] = await Promise.all([
    supabase
      .from("palette_colors")
      .select(PALETTE_COLUMNS)
      .eq("vocabulary_id", vocabularyId)
      .order("position", { ascending: true }),
    boardIds.length
      ? supabase
          .from("buttons")
          .select(BUTTON_COLUMNS)
          .in("board_id", boardIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    boardIds.length
      ? supabase
          .from("snippet_inclusions")
          .select(INCLUSION_COLUMNS)
          .in("host_id", boardIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = paletteResult.error ?? buttonsResult.error ?? inclusionsResult.error;
  if (firstError) return { error: firstError.message };

  return {
    snapshot: {
      boards,
      buttons: (buttonsResult.data ?? []) as SnapshotButton[],
      palette_colors: (paletteResult.data ?? []) as SnapshotPaletteColor[],
      snippet_inclusions: (inclusionsResult.data ?? []) as SnapshotInclusion[],
    },
  };
}
