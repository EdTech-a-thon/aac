/**
 * Creation order within one Change Set.
 *
 * Requires the creation-order migration to be applied: without it every row a
 * Change Set creates shares the transaction timestamp, and the domain's
 * identifier tiebreak decides draw order, inclusion layering and the Home Board
 * arbitrarily.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string };
type Board = { id: string; name: string; created_at: string };
type Button = { id: string; label: string; created_at: string };
type SnippetInclusion = { id: string; host_id: string; snippet_id: string; created_at: string };
type ChangeSet = { id: string; status: "applied" | "suggested" };

async function createManagedVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  name: string,
) {
  const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
    accessToken,
    body: { name },
  });
  expect(created.status).toBe(201);
  return created.body.vocabulary;
}

function isStrictlyIncreasing(rows: { created_at: string }[]) {
  return rows.every(
    (row, index) => index === 0 || rows[index - 1].created_at < row.created_at,
  );
}

describe("Creation order within one Change Set", () => {
  it("orders Buttons created by one Change Set by submission order", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Order buttons");
    const boardId = randomUUID();

    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            { op: "create_board", id: boardId, name: "Home", width: 4, height: 3 },
            // All three occupy the same cell: only creation order separates them.
            ...["under", "middle", "over"].map((label) => ({
              op: "create_button",
              id: randomUUID(),
              board_id: boardId,
              row_index: 0,
              col_index: 0,
              label,
            })),
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.body.buttons.map((button) => button.label)).toEqual([
      "under",
      "middle",
      "over",
    ]);
    // The last-submitted Button must win draw and hit order, which the domain
    // decides by creation time — so the times must genuinely differ.
    expect(isStrictlyIncreasing(buttons.body.buttons)).toBe(true);
  });

  it("orders Boards created by one Change Set by submission order, so the first is the Home Board", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Order boards");
    const names = ["Home", "Food", "Drinks", "Places"];

    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: names.map((name) => ({
            op: "create_board",
            id: randomUUID(),
            name,
            width: 3,
            height: 3,
          })),
        },
      },
    );
    expect(submitted.status).toBe(201);

    const boards = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: manager.accessToken },
    );
    expect(boards.body.boards.map((board) => board.name)).toEqual(names);
    expect(isStrictlyIncreasing(boards.body.boards)).toBe(true);
  });

  it("orders Snippet Inclusions created by one Change Set by submission order", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Order inclusions");
    const hostId = randomUUID();
    const firstSnippetId = randomUUID();
    const secondSnippetId = randomUUID();
    const olderInclusionId = randomUUID();
    const newerInclusionId = randomUUID();

    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            { op: "create_board", id: hostId, name: "Host", width: 6, height: 4 },
            {
              op: "create_board",
              id: firstSnippetId,
              name: "Older",
              width: 2,
              height: 1,
              kind: "snippet",
            },
            {
              op: "create_board",
              id: secondSnippetId,
              name: "Newer",
              width: 2,
              height: 1,
              kind: "snippet",
            },
            // Both land on the same origin: the later-submitted inclusion wins.
            {
              op: "create_snippet_inclusion",
              id: olderInclusionId,
              host_id: hostId,
              snippet_id: firstSnippetId,
              origin_row: 0,
              origin_col: 0,
            },
            {
              op: "create_snippet_inclusion",
              id: newerInclusionId,
              host_id: hostId,
              snippet_id: secondSnippetId,
              origin_row: 0,
              origin_col: 0,
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);

    const inclusions = await apiJson<{ snippetInclusions: SnippetInclusion[] }>(
      app,
      `/vocabularies/${vocabulary.id}/snippet-inclusions`,
      { accessToken: manager.accessToken },
    );
    expect(inclusions.body.snippetInclusions.map((inclusion) => inclusion.id)).toEqual([
      olderInclusionId,
      newerInclusionId,
    ]);
    expect(isStrictlyIncreasing(inclusions.body.snippetInclusions)).toBe(true);
  });

  it("orders a Suggested Change Set's rows the same way once it is applied", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Order suggested");
    const boardId = randomUUID();

    const suggested = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        accessToken: manager.accessToken,
        body: {
          status: "suggested",
          mutations: [
            { op: "create_board", id: boardId, name: "Home", width: 4, height: 3 },
            ...["under", "middle", "over"].map((label) => ({
              op: "create_button",
              id: randomUUID(),
              board_id: boardId,
              row_index: 1,
              col_index: 1,
              label,
            })),
          ],
        },
      },
    );
    expect(suggested.status).toBe(201);

    const applied = await apiJson(
      app,
      `/vocabularies/${vocabulary.id}/change-sets/${suggested.body.changeSet.id}/apply`,
      { accessToken: manager.accessToken, method: "POST" },
    );
    expect(applied.status).toBe(200);

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.body.buttons.map((button) => button.label)).toEqual([
      "under",
      "middle",
      "over",
    ]);
    expect(isStrictlyIncreasing(buttons.body.buttons)).toBe(true);
  });

  it("keeps ordering rows from separate Change Sets by when each was applied", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Order across");
    const boardId = randomUUID();

    for (const labels of [["first", "second"], ["third", "fourth"]]) {
      const mutations: Record<string, unknown>[] = [];
      if (labels[0] === "first") {
        mutations.push({ op: "create_board", id: boardId, name: "Home", width: 4, height: 3 });
      }
      for (const label of labels) {
        mutations.push({
          op: "create_button",
          id: randomUUID(),
          board_id: boardId,
          row_index: 2,
          col_index: 2,
          label,
        });
      }
      const submitted = await apiJson(app, `/vocabularies/${vocabulary.id}/change-sets`, {
        accessToken: manager.accessToken,
        body: { status: "applied", mutations },
      });
      expect(submitted.status).toBe(201);
    }

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.body.buttons.map((button) => button.label)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
    expect(isStrictlyIncreasing(buttons.body.buttons)).toBe(true);
  });
});
