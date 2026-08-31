import { Hono } from "hono";
import { createServiceSupabaseClient } from "../supabase.ts";
import { withDisplayName } from "../displayName.ts";
import { optionalUserId, requireAuth, type AuthVariables } from "../middleware/auth.ts";
import { remapVocabularySnapshot, type VocabularyCopySnapshot } from "../copyVocabulary.ts";
import { cloudflareReportMailer, notifyPendingReports } from "../reportNotifier.ts";
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
export const galleryRoutes = new Hono<{ Variables: AuthVariables }>();

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

/** Endorsements currently standing, per Publication. */
async function standingEndorsements(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  publicationIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (publicationIds.length === 0) return counts;
  const { data } = await supabase
    .from("endorsements")
    .select("publication_id")
    .eq("standing", true)
    .in("publication_id", publicationIds);
  for (const row of (data ?? []) as { publication_id: string }[]) {
    counts.set(row.publication_id, (counts.get(row.publication_id) ?? 0) + 1);
  }
  return counts;
}

/** The live Publication behind a slug, or null when there is nothing to show. */
async function publishedBySlug(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  slug: string,
): Promise<PublicationRow | null> {
  if (!looksLikeSlug(slug)) return null;
  const { data, error } = await supabase
    .from("publications")
    .select("id, slug, published, current_version_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const publication = data as PublicationRow;
  if (!publication.published || !publication.current_version_id) return null;
  return publication;
}

type PublicationSummaryRow = {
  id: string;
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
 * The Gallery index. Ordered by standing Endorsements by default, with newest
 * offered alongside; copy counts are deliberately never a ranking signal
 * (ADR 0014). Nothing is recorded when a Publication is seen.
 */
galleryRoutes.get("/", async (c) => {
  const query = (c.req.query("q") ?? "").trim();
  const sort = c.req.query("sort") === "newest" ? "newest" : "endorsed";

  const supabase = createServiceSupabaseClient();
  let request = supabase
    .from("publications")
    .select(
      "id, slug, current_version_id, publication_versions!publications_current_version_fkey(name, description, attribution, board_count, button_count, min_columns, min_rows, max_columns, max_rows, created_at)",
    )
    .eq("published", true)
    .not("current_version_id", "is", null);

  if (query) {
    // Case-insensitive substring over the title and description as published,
    // never over the live Vocabulary's current name.
    const stripped = query.replace(/[%,()]/g, " ");
    request = request.or(
      `name.ilike.%${stripped}%,description.ilike.%${stripped}%`,
      { referencedTable: "publication_versions" },
    );
  }

  const { data, error } = await request;
  if (error) return c.json({ publications: [], query });

  const rows = ((data ?? []) as unknown as PublicationSummaryRow[]).filter(
    (row) => row.publication_versions !== null,
  );
  const counts = await standingEndorsements(
    supabase,
    rows.map((row) => row.id),
  );

  const summaries = rows.map((row) => {
    const version = row.publication_versions!;
    return {
      slug: row.slug,
      title: version.name,
      description: version.description,
      attribution: version.attribution,
      publishedAt: version.created_at,
      endorsementCount: counts.get(row.id) ?? 0,
      figures: {
        boardCount: version.board_count,
        buttonCount: version.button_count,
        minColumns: version.min_columns,
        minRows: version.min_rows,
        maxColumns: version.max_columns,
        maxRows: version.max_rows,
      },
    };
  });

  // Most-endorsed is the default: it is the one signal the publisher agreed to
  // make public. Copy counts are the better data and are deliberately never
  // used for ranking (ADR 0014). Newest breaks ties and is offered outright.
  const newest = (a: { publishedAt: string }, b: { publishedAt: string }) =>
    b.publishedAt.localeCompare(a.publishedAt);
  summaries.sort(
    sort === "newest"
      ? newest
      : (a, b) => b.endorsementCount - a.endorsementCount || newest(a, b),
  );

  return c.json({ publications: summaries, query, sort });
});

galleryRoutes.get("/:slug", async (c) => {
  const supabase = createServiceSupabaseClient();
  const publication = await publishedBySlug(supabase, c.req.param("slug"));
  if (!publication) return c.json(UNAVAILABLE, 404);

  const versionResult = await supabase
    .from("publication_versions")
    .select(
      "id, seq, name, description, attribution, snapshot, board_count, button_count, min_columns, min_rows, max_columns, max_rows, created_at",
    )
    .eq("id", publication.current_version_id)
    .maybeSingle();
  if (versionResult.error || !versionResult.data) return c.json(UNAVAILABLE, 404);
  const version = versionResult.data as VersionRow;

  // A signed-in visitor sees their own standing so the control can show it.
  // Nobody sees anyone else's, including this Publication's own Managers.
  const viewerId = await optionalUserId(c.req.header("Authorization"));
  const counts = await standingEndorsements(supabase, [publication.id]);
  let youEndorsed = false;
  if (viewerId) {
    const { data: mine } = await supabase
      .from("endorsements")
      .select("standing")
      .eq("publication_id", publication.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    youEndorsed = (mine as { standing: boolean } | null)?.standing === true;
  }

  return c.json({
    publication: {
      slug: publication.slug,
      endorsementCount: counts.get(publication.id) ?? 0,
      youEndorsed,
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

/** Endorse, or withdraw an Endorsement. A toggle, and the count comes back with it. */
galleryRoutes.post("/:slug/endorsement", requireAuth, async (c) => {
  const service = createServiceSupabaseClient();
  const publication = await publishedBySlug(service, c.req.param("slug"));
  if (!publication) return c.json(UNAVAILABLE, 404);

  const body = await c.req
    .json<{ standing?: boolean }>()
    .catch((): { standing?: boolean } => ({}));

  const { data, error } = await c.get("supabase").rpc("set_endorsement", {
    p_publication_id: publication.id,
    p_standing: body.standing !== false,
  });
  if (error) return c.json({ error: error.message }, 400);

  return c.json(data as { standing: boolean; count: number });
});

/**
 * Keep a Publication as a Vocabulary of your own.
 *
 * The snapshot is what the Visitor could see, their own local edits folded in,
 * the same way saving from a Share Link works. The Copy record and the new
 * Vocabulary are written together, so the count can never claim a Vocabulary
 * that does not exist and a failed copy records nothing.
 */
galleryRoutes.post("/:slug/copy", requireAuth, async (c) => {
  const service = createServiceSupabaseClient();
  const publication = await publishedBySlug(service, c.req.param("slug"));
  if (!publication) return c.json(UNAVAILABLE, 404);

  const versionResult = await service
    .from("publication_versions")
    .select("id, name, description, snapshot")
    .eq("id", publication.current_version_id!)
    .maybeSingle();
  if (versionResult.error || !versionResult.data) return c.json(UNAVAILABLE, 404);
  const version = versionResult.data as {
    id: string;
    name: string;
    description: string;
    snapshot: VocabularyCopySnapshot;
  };

  const body = await c.req
    .json<{ name?: string; snapshot?: VocabularyCopySnapshot }>()
    .catch((): { name?: string; snapshot?: VocabularyCopySnapshot } => ({}));

  const source = body.snapshot ?? version.snapshot;
  const copied = remapVocabularySnapshot(source);

  const { data, error } = await c.get("supabase").rpc("save_publication_copy", {
    p_publication_version_id: version.id,
    p_name: typeof body.name === "string" && body.name.trim() ? body.name : version.name,
    p_description: version.description,
    p_initial_snapshot: copied.initialSnapshot,
    p_mutations: copied.mutations,
  });
  if (error) return c.json({ error: error.message }, 400);

  return c.json({ vocabulary: withDisplayName(data as { id: string; name: string }) }, 201);
});

/**
 * Report a Publication. Anyone may, signed in or not, and a reason is required —
 * it is what makes a report actionable, and it raises the cost of drive-by
 * abuse. The row is written with the service role, so anon needs no table
 * access (ADR 0010). Storing it never depends on the email succeeding.
 */
galleryRoutes.post("/:slug/reports", async (c) => {
  const service = createServiceSupabaseClient();
  const publication = await publishedBySlug(service, c.req.param("slug"));
  if (!publication) return c.json(UNAVAILABLE, 404);

  const body = await c.req.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
  const reason = (body.reason ?? "").trim();
  if (!reason) return c.json({ error: "Say what is wrong with this." }, 400);

  const reporterId = await optionalUserId(c.req.header("Authorization"));
  const { error } = await service.from("publication_reports").insert({
    publication_id: publication.id,
    reporter_id: reporterId,
    reason: reason.slice(0, 2000),
  });
  if (error) return c.json({ error: "Could not record that report" }, 400);

  // The email is a nudge toward the row, never the record itself, so a failure
  // here leaves the report safely stored and the caller none the wiser.
  await notifyPendingReports(
    service,
    cloudflareReportMailer(),
    process.env.PUBLIC_SITE_URL ?? "",
  );

  return c.json({ reported: true }, 201);
});
