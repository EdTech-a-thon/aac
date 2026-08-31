import { Hono } from "hono";
import { createServiceSupabaseClient } from "../supabase.ts";
import { withDisplayName } from "../displayName.ts";
import type {
  FullVocabularySnapshot,
  SnapshotButton,
} from "../vocabularySnapshot.ts";

/**
 * The Gallery's public side. Anonymous by design, so — following ADR 0010 —
 * this validates what it is asked for and reads with the service role rather
 * than granting anon any table access.
 *
 * Everything served here comes from a stored Publication Version. No query in
 * this file touches a live Vocabulary table: a frozen version must not be
 * described by content that has moved on.
 */
export const galleryRoutes = new Hono();

/** A withdrawn Publication and one that never existed look the same from out here. */
const UNAVAILABLE = { error: "This isn't available" };

/** Slugs are lowercase alphanumerics and hyphens; anything else never reaches the table. */
function looksLikeSlug(slug: string) {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug);
}

type PublicationRow = {
  id: string;
  slug: string;
  published: boolean;
  current_version_id: string | null;
};

type VersionRow = {
  id: string;
  seq: number;
  name: string;
  description: string;
  attribution: string;
  snapshot: FullVocabularySnapshot;
  board_count: number;
  button_count: number;
  min_columns: number;
  min_rows: number;
  max_columns: number;
  max_rows: number;
  created_at: string;
};

/** The stored snapshot, in the shape the board canvas already renders. */
export function publicationContent(snapshot: FullVocabularySnapshot) {
  const buttonsByBoardId: Record<string, SnapshotButton[]> = {};
  for (const board of snapshot.boards) buttonsByBoardId[board.id] = [];
  for (const button of snapshot.buttons) {
    buttonsByBoardId[button.board_id]?.push(button);
  }
  return {
    boards: snapshot.boards.map(withDisplayName),
    buttonsByBoardId,
    paletteColors: snapshot.palette_colors,
    snippetInclusions: snapshot.snippet_inclusions,
    // A Manager-only warning, never visible to anyone reading the Gallery.
    unresolvedCopyActions: [],
  };
}

type ListingRow = {
  slug: string;
  current_version_id: string | null;
  publication_versions: {
    name: string;
    description: string;
    attribution: string;
    board_count: number;
    button_count: number;
    min_columns: number;
    min_rows: number;
    max_columns: number;
    max_rows: number;
    created_at: string;
  } | null;
};

/**
 * The Gallery index. Newest first for now — most-endorsed becomes the default
 * once Endorsements exist, and copy counts are deliberately never a ranking
 * signal (ADR 0014). Nothing is recorded when a listing is seen.
 */
galleryRoutes.get("/", async (c) => {
  const query = (c.req.query("q") ?? "").trim();

  const supabase = createServiceSupabaseClient();
  let request = supabase
    .from("publications")
    .select(
      "slug, current_version_id, publication_versions!publications_current_version_fkey(name, description, attribution, board_count, button_count, min_columns, min_rows, max_columns, max_rows, created_at)",
    )
    .eq("published", true)
    .not("current_version_id", "is", null);

  if (query) {
    // Case-insensitive substring over the title and description as published,
    // never over the live Vocabulary's current name.
    const escaped = query.replace(/[%,()]/g, " ");
    request = request.or(
      `name.ilike.%${escaped}%,description.ilike.%${escaped}%`,
      { referencedTable: "publication_versions" },
    );
  }

  const { data, error } = await request;
  if (error) return c.json({ publications: [], query });

  const listings = ((data ?? []) as unknown as ListingRow[])
    .filter((row) => row.publication_versions !== null)
    .map((row) => {
      const version = row.publication_versions!;
      return {
        slug: row.slug,
        title: version.name,
        description: version.description,
        attribution: version.attribution,
        publishedAt: version.created_at,
        figures: {
          boardCount: version.board_count,
          buttonCount: version.button_count,
          minColumns: version.min_columns,
          minRows: version.min_rows,
          maxColumns: version.max_columns,
          maxRows: version.max_rows,
        },
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return c.json({ publications: listings, query });
});

galleryRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!looksLikeSlug(slug)) return c.json(UNAVAILABLE, 404);

  const supabase = createServiceSupabaseClient();
  const publicationResult = await supabase
    .from("publications")
    .select("id, slug, published, current_version_id")
    .eq("slug", slug)
    .maybeSingle();
  if (publicationResult.error || !publicationResult.data) return c.json(UNAVAILABLE, 404);

  const publication = publicationResult.data as PublicationRow;
  if (!publication.published || !publication.current_version_id) {
    return c.json(UNAVAILABLE, 404);
  }

  const versionResult = await supabase
    .from("publication_versions")
    .select(
      "id, seq, name, description, attribution, snapshot, board_count, button_count, min_columns, min_rows, max_columns, max_rows, created_at",
    )
    .eq("id", publication.current_version_id)
    .maybeSingle();
  if (versionResult.error || !versionResult.data) return c.json(UNAVAILABLE, 404);
  const version = versionResult.data as VersionRow;

  return c.json({
    publication: {
      slug: publication.slug,
      title: version.name,
      description: version.description,
      attribution: version.attribution,
      versionId: version.id,
      seq: version.seq,
      publishedAt: version.created_at,
      figures: {
        boardCount: version.board_count,
        buttonCount: version.button_count,
        minColumns: version.min_columns,
        minRows: version.min_rows,
        maxColumns: version.max_columns,
        maxRows: version.max_rows,
      },
    },
    content: publicationContent(version.snapshot),
  });
});
