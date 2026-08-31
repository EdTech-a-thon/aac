/**
 * Publishing a Vocabulary to the Gallery, and reading it back anonymously.
 *
 * Requires the publications migration to be applied.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { apiJson, createTestUser, requireEnv, testApp } from "./helpers.ts";

type Vocabulary = { id: string; name: string; description: string };
type ConsentText = { id: string; clause: string; wording: string };

type PublicationState = {
  publication: {
    slug: string;
    published: boolean;
    currentVersion: { id: string; seq: number; name: string; description: string } | null;
  } | null;
  consentTexts: ConsentText[];
  preflight: {
    figures: {
      board_count: number;
      button_count: number;
      min_columns: number;
      min_rows: number;
      max_columns: number;
      max_rows: number;
    };
    symbolDigests: string[];
    problems: string[];
    unresolvedCopyActionCount: number;
  };
};

type GalleryPage = {
  publication: {
    slug: string;
    title: string;
    description: string;
    attribution: string;
    figures: { boardCount: number; buttonCount: number };
  };
  content: {
    boards: { id: string; name: string }[];
    buttonsByBoardId: Record<string, { label: string }[]>;
    paletteColors: unknown[];
  };
  error?: string;
};

const app = testApp();

async function createVocabulary(accessToken: string, name: string) {
  const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
    accessToken,
    body: { name },
  });
  expect(created.status).toBe(201);
  return created.body.vocabulary;
}

async function apply(accessToken: string, id: string, mutations: Record<string, unknown>[]) {
  const submitted = await apiJson(app, `/vocabularies/${id}/change-sets`, {
    accessToken,
    body: { status: "applied", mutations },
  });
  expect(submitted.status).toBe(201);
}

const publicationState = (accessToken: string, id: string) =>
  apiJson<PublicationState>(app, `/vocabularies/${id}/publication`, { accessToken });

async function allConfirmations(accessToken: string, id: string) {
  const state = await publicationState(accessToken, id);
  return state.body.consentTexts.map((text) => ({
    clause: text.clause,
    consentTextId: text.id,
  }));
}

const publish = (accessToken: string, id: string, body: Record<string, unknown>) =>
  apiJson<{ publication: { slug: string } | null; error?: string }>(
    app,
    `/vocabularies/${id}/publish`,
    { accessToken, body },
  );

/** A Vocabulary that satisfies every precondition, ready to publish. */
async function publishableVocabulary(accessToken: string, name: string) {
  const vocabulary = await createVocabulary(accessToken, name);
  await apiJson(app, `/vocabularies/${vocabulary.id}`, {
    method: "PATCH",
    accessToken,
    body: { description: "Core words for a beginning communicator." },
  });
  const homeId = randomUUID();
  await apply(accessToken, vocabulary.id, [
    { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
    {
      op: "create_button",
      id: randomUUID(),
      board_id: homeId,
      row_index: 0,
      col_index: 0,
      label: "more",
    },
  ]);
  return { vocabulary, homeId };
}

describe("Publishing preconditions", () => {
  it("refuses a Vocabulary with no description, and says so before the attempt", async () => {
    const user = await createTestUser();
    const vocabulary = await createVocabulary(user.accessToken, "Nameless blurb");
    await apply(user.accessToken, vocabulary.id, [
      { op: "create_board", id: randomUUID(), name: "Home", width: 4, height: 3 },
    ]);

    const state = await publicationState(user.accessToken, vocabulary.id);
    expect(state.body.preflight.problems.join(" ")).toContain("description");

    const attempt = await publish(user.accessToken, vocabulary.id, {
      confirmations: await allConfirmations(user.accessToken, vocabulary.id),
    });
    expect(attempt.status).toBe(400);
    expect(attempt.body.error).toContain("description");
  });

  it("refuses a Vocabulary with no Boards", async () => {
    const user = await createTestUser();
    const vocabulary = await createVocabulary(user.accessToken, "Empty");
    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: "Nothing in it yet." },
    });

    const state = await publicationState(user.accessToken, vocabulary.id);
    expect(state.body.preflight.problems.join(" ")).toContain("Board");

    const attempt = await publish(user.accessToken, vocabulary.id, {
      confirmations: await allConfirmations(user.accessToken, vocabulary.id),
    });
    expect(attempt.status).toBe(400);
  });

  it("refuses to publish without all three confirmations", async () => {
    const user = await createTestUser();
    const { vocabulary } = await publishableVocabulary(user.accessToken, "Partly confirmed");
    const confirmations = await allConfirmations(user.accessToken, vocabulary.id);

    const none = await publish(user.accessToken, vocabulary.id, { confirmations: [] });
    expect(none.status).toBe(400);

    const two = await publish(user.accessToken, vocabulary.id, {
      confirmations: confirmations.slice(0, 2),
    });
    expect(two.status).toBe(400);

    const all = await publish(user.accessToken, vocabulary.id, { confirmations });
    expect(all.status).toBe(201);
  });

  it("refuses a confirmation whose wording belongs to a different clause", async () => {
    const user = await createTestUser();
    const { vocabulary } = await publishableVocabulary(user.accessToken, "Mismatched wording");
    const confirmations = await allConfirmations(user.accessToken, vocabulary.id);

    const rights = confirmations.find((entry) => entry.clause === "rights")!;
    const privacy = confirmations.find((entry) => entry.clause === "no_personal_content")!;

    // Filing the privacy wording as the copyright confirmation would make the
    // Attestation claim something nobody agreed to.
    const swapped = await publish(user.accessToken, vocabulary.id, {
      confirmations: [
        { clause: "rights", consentTextId: privacy.consentTextId },
        { clause: "free_to_copy", consentTextId: rights.consentTextId },
        privacy,
      ],
    });
    expect(swapped.status).toBe(400);
  });

  it("refuses a confirmation naming a wording we never recorded", async () => {
    const user = await createTestUser();
    const { vocabulary } = await publishableVocabulary(user.accessToken, "Invented wording");
    const confirmations = await allConfirmations(user.accessToken, vocabulary.id);

    const invented = await publish(user.accessToken, vocabulary.id, {
      confirmations: confirmations.map((entry) =>
        entry.clause === "rights" ? { ...entry, consentTextId: randomUUID() } : entry,
      ),
    });
    expect(invented.status).toBe(400);
  });

  it("does not let a non-Manager publish", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const { vocabulary } = await publishableVocabulary(owner.accessToken, "Not yours");

    const attempt = await publish(stranger.accessToken, vocabulary.id, {
      confirmations: await allConfirmations(owner.accessToken, vocabulary.id),
    });
    expect(attempt.status).toBe(404);
  });
});

describe("A published Vocabulary", () => {
  it("is readable at its slug by a signed-out person, and freezes what it captured", async () => {
    const user = await createTestUser();
    const { vocabulary, homeId } = await publishableVocabulary(
      user.accessToken,
      "Everyday Core Words",
    );

    const published = await publish(user.accessToken, vocabulary.id, {
      attribution: "Riverside SLP Team",
      confirmations: await allConfirmations(user.accessToken, vocabulary.id),
    });
    expect(published.status).toBe(201);
    const slug = published.body.publication!.slug;
    // Human-readable and derived from the name. A previous run may already hold
    // the bare slug, in which case this one is suffixed rather than rejected.
    expect(slug).toMatch(/^everyday-core-words(-\d+)?$/);

    // No access token at all: the Gallery is anonymous.
    const page = await apiJson<GalleryPage>(app, `/gallery/${slug}`);
    expect(page.status).toBe(200);
    expect(page.body.publication.title).toBe("Everyday Core Words");
    expect(page.body.publication.description).toBe(
      "Core words for a beginning communicator.",
    );
    expect(page.body.publication.attribution).toBe("Riverside SLP Team");
    expect(page.body.publication.figures).toMatchObject({
      boardCount: 1,
      buttonCount: 1,
    });
    expect(page.body.content.boards.map((board) => board.name)).toEqual(["Home"]);

    // Editing the Vocabulary afterwards changes nothing at the public URL.
    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { name: "Renamed after publishing", description: "Rewritten after publishing." },
    });
    await apply(user.accessToken, vocabulary.id, [
      { op: "create_board", id: randomUUID(), name: "Added after publishing", width: 2, height: 2 },
      { op: "update_board", id: homeId, name: "Renamed board" },
    ]);

    const again = await apiJson<GalleryPage>(app, `/gallery/${slug}`);
    expect(again.body.publication.title).toBe("Everyday Core Words");
    expect(again.body.publication.description).toBe(
      "Core words for a beginning communicator.",
    );
    expect(again.body.content.boards.map((board) => board.name)).toEqual(["Home"]);
    expect(again.body.publication.figures.boardCount).toBe(1);
  });

  it("keeps its slug when the Vocabulary is renamed, and never collides", async () => {
    const user = await createTestUser();
    const first = await publishableVocabulary(user.accessToken, "Shared Name");
    const second = await publishableVocabulary(user.accessToken, "Shared Name");

    const a = await publish(user.accessToken, first.vocabulary.id, {
      confirmations: await allConfirmations(user.accessToken, first.vocabulary.id),
    });
    const b = await publish(user.accessToken, second.vocabulary.id, {
      confirmations: await allConfirmations(user.accessToken, second.vocabulary.id),
    });
    expect(a.body.publication!.slug).not.toBe(b.body.publication!.slug);

    await apiJson(app, `/vocabularies/${first.vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { name: "A completely different name" },
    });
    const state = await publicationState(user.accessToken, first.vocabulary.id);
    expect(state.body.publication!.slug).toBe(a.body.publication!.slug);
  });

  it("reports its figures and Symbols to the Manager before publishing", async () => {
    const user = await createTestUser();
    const vocabulary = await createVocabulary(user.accessToken, "Sized");
    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: "Two boards of different sizes." },
    });
    const smallId = randomUUID();
    const bigId = randomUUID();
    const snippetId = randomUUID();
    await apply(user.accessToken, vocabulary.id, [
      { op: "create_board", id: smallId, name: "Small", width: 2, height: 2 },
      { op: "create_board", id: bigId, name: "Big", width: 8, height: 6 },
      { op: "create_board", id: snippetId, name: "Strip", width: 4, height: 1, kind: "snippet" },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: smallId,
        row_index: 0,
        col_index: 0,
        label: "one",
      },
      {
        op: "create_button",
        id: randomUUID(),
        board_id: snippetId,
        row_index: 0,
        col_index: 0,
        label: "on a snippet",
      },
    ]);

    const state = await publicationState(user.accessToken, vocabulary.id);
    expect(state.body.preflight.figures).toMatchObject({
      board_count: 2,
      button_count: 2,
      min_columns: 2,
      min_rows: 2,
      max_columns: 8,
      max_rows: 6,
    });
    expect(state.body.preflight.problems).toEqual([]);
    expect(state.body.preflight.symbolDigests).toEqual([]);
  });

  it("is not reachable before it has been published", async () => {
    const user = await createTestUser();
    await publishableVocabulary(user.accessToken, "Still private");

    const missing = await apiJson<GalleryPage>(app, "/gallery/still-private");
    expect(missing.status).toBe(404);
  });

  it("does not disclose whether an unknown slug ever existed", async () => {
    const nonsense = await apiJson<GalleryPage>(app, "/gallery/no-such-thing-at-all");
    expect(nonsense.status).toBe(404);
    expect(nonsense.body.error).toBe("This isn't available");
  });
});

describe("The Attestation recorded when publishing", () => {
  it("stores each confirmation separately, naming who, when, and the exact wording", async () => {
    const user = await createTestUser();
    const { vocabulary } = await publishableVocabulary(user.accessToken, "Attested Words");
    const confirmations = await allConfirmations(user.accessToken, vocabulary.id);

    const published = await apiJson<{ version: { id: string } }>(
      app,
      `/vocabularies/${vocabulary.id}/publish`,
      { accessToken: user.accessToken, body: { confirmations } },
    );
    expect(published.status).toBe(201);

    const service = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data } = await service
      .from("publication_attestations")
      .select("clause, consent_text_id, attested_by, attested_at")
      .eq("publication_version_id", published.body.version.id);

    const rows = (data ?? []) as {
      clause: string;
      consent_text_id: string;
      attested_by: string;
      attested_at: string;
    }[];

    expect(rows.map((row) => row.clause).sort()).toEqual([
      "free_to_copy",
      "no_personal_content",
      "rights",
    ]);
    for (const row of rows) {
      expect(row.attested_by).toBe(user.userId);
      expect(row.attested_at).toBeTruthy();
      // The wording is referenced, not copied, so it can always be recovered.
      const match = confirmations.find((entry) => entry.clause === row.clause);
      expect(row.consent_text_id).toBe(match!.consentTextId);
    }
  });

  it("attests every version separately, so consent to one is not consent to the next", async () => {
    const user = await createTestUser();
    const { vocabulary } = await publishableVocabulary(user.accessToken, "Twice Attested");
    const confirmations = await allConfirmations(user.accessToken, vocabulary.id);

    const first = await apiJson<{ version: { id: string; seq: number } }>(
      app,
      `/vocabularies/${vocabulary.id}/publish`,
      { accessToken: user.accessToken, body: { confirmations } },
    );
    const second = await apiJson<{ version: { id: string; seq: number } }>(
      app,
      `/vocabularies/${vocabulary.id}/publish`,
      { accessToken: user.accessToken, body: { confirmations } },
    );

    expect(first.body.version.seq).toBe(1);
    expect(second.body.version.seq).toBe(2);
    expect(second.body.version.id).not.toBe(first.body.version.id);

    const service = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    for (const versionId of [first.body.version.id, second.body.version.id]) {
      const { data } = await service
        .from("publication_attestations")
        .select("clause")
        .eq("publication_version_id", versionId);
      expect((data ?? []).length).toBe(3);
    }
  });
});

describe("What a Publication Version captures", () => {
  it("keeps Palette bindings, Open Board Actions, and Snippets in the frozen snapshot", async () => {
    const user = await createTestUser();
    const vocabulary = await createVocabulary(user.accessToken, "Faithful Capture");
    await apiJson(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: user.accessToken,
      body: { description: "Everything that should survive publishing." },
    });

    const homeId = randomUUID();
    const foodId = randomUUID();
    const snippetId = randomUUID();
    const colorId = randomUUID();
    const boundButtonId = randomUUID();

    await apply(user.accessToken, vocabulary.id, [
      { op: "create_palette_color", id: colorId, hex: "#ff0000", name: "Nouns", description: "", position: 0 },
      { op: "create_board", id: homeId, name: "Home", width: 4, height: 3 },
      { op: "create_board", id: foodId, name: "Food", width: 2, height: 2 },
      { op: "create_board", id: snippetId, name: "Strip", width: 4, height: 1, kind: "snippet" },
      {
        op: "create_button",
        id: boundButtonId,
        board_id: homeId,
        row_index: 0,
        col_index: 0,
        label: "food",
        palette_color_id: colorId,
        action: { kind: "open_board", board_id: foodId },
      },
      {
        op: "create_snippet_inclusion",
        id: randomUUID(),
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 2,
        origin_col: 0,
      },
    ]);

    const published = await publish(user.accessToken, vocabulary.id, {
      confirmations: await allConfirmations(user.accessToken, vocabulary.id),
    });
    const slug = published.body.publication!.slug;

    const page = await apiJson<{
      content: {
        boards: { id: string; name: string; kind: string }[];
        buttonsByBoardId: Record<
          string,
          { label: string; palette_color_id: string | null; action: { kind: string; board_id: string } | null }[]
        >;
        paletteColors: { id: string; hex: string }[];
        snippetInclusions: { host_id: string; snippet_id: string; origin_row: number }[];
      };
    }>(app, `/gallery/${slug}`);

    expect(page.status).toBe(200);
    // A blank Vocabulary starts with a Fitzgerald-default Palette, so the
    // colour created here joins those rather than replacing them.
    expect(page.body.content.paletteColors.map((color) => color.hex)).toContain("#ff0000");
    expect(page.body.content.boards.map((board) => board.name).sort()).toEqual([
      "Food",
      "Home",
      "Strip",
    ]);
    expect(page.body.content.boards.find((board) => board.name === "Strip")!.kind).toBe("snippet");

    const home = page.body.content.boards.find((board) => board.name === "Home")!;
    const button = page.body.content.buttonsByBoardId[home.id][0];
    expect(button.label).toBe("food");
    expect(button.palette_color_id).toBe(colorId);
    expect(button.action).toMatchObject({ kind: "open_board", board_id: foodId });

    expect(page.body.content.snippetInclusions).toMatchObject([
      { host_id: homeId, snippet_id: snippetId, origin_row: 2 },
    ]);
  });
});
