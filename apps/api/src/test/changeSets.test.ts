import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string; name: string };
type Board = {
  id: string;
  vocabulary_id: string;
  name: string;
  width: number;
  height: number;
};
type Button = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string;
};
type ChangeSet = {
  id: string;
  vocabulary_id: string;
  author_id: string;
  status: "applied" | "suggested";
  mutations: unknown[];
  applied_seq: number | null;
};

async function createManagedVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  name = "Vocab",
) {
  const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
    method: "POST",
    accessToken,
    body: { name },
  });
  expect(created.status).toBe(201);
  return created.body.vocabulary;
}

describe("Change Sets HTTP API", () => {
  it("Manager can submit an Applied Change Set and boards reflect it", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(
      app,
      manager.accessToken,
      "CS Applied",
    );

    const boardId = randomUUID();
    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "create_board",
              id: boardId,
              name: "Home",
              width: 3,
              height: 2,
            },
          ],
        },
      },
    );

    expect(submitted.status).toBe(201);
    expect(submitted.body.changeSet.status).toBe("applied");
    expect(submitted.body.changeSet.author_id).toBe(manager.userId);
    expect(submitted.body.changeSet.applied_seq).toBe(1);

    const boards = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: manager.accessToken },
    );
    expect(boards.status).toBe(200);
    expect(boards.body.boards).toEqual([
      expect.objectContaining({
        id: boardId,
        name: "Home",
        width: 3,
        height: 2,
      }),
    ]);
  });

  it("Suggested Change Set does not change live boards until applied", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(
      app,
      manager.accessToken,
      "CS Suggested",
    );

    const boardId = randomUUID();
    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "suggested",
          mutations: [
            {
              op: "create_board",
              id: boardId,
              name: "Draft",
              width: 2,
              height: 2,
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);
    expect(submitted.body.changeSet.status).toBe("suggested");
    expect(submitted.body.changeSet.applied_seq).toBeNull();

    const before = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: manager.accessToken },
    );
    expect(before.body.boards).toEqual([]);

    const applied = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets/${submitted.body.changeSet.id}/apply`,
      { method: "POST", accessToken: manager.accessToken },
    );
    expect(applied.status).toBe(200);
    expect(applied.body.changeSet.id).toBe(submitted.body.changeSet.id);
    expect(applied.body.changeSet.status).toBe("applied");

    const after = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: manager.accessToken },
    );
    expect(after.body.boards).toEqual([
      expect.objectContaining({ id: boardId, name: "Draft" }),
    ]);
  });

  it("Manager can delete a Suggested Change Set", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "suggested",
          mutations: [
            {
              op: "create_board",
              id: randomUUID(),
              name: "Nope",
              width: 1,
              height: 1,
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);

    const deleted = await apiJson<{ ok: boolean }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets/${submitted.body.changeSet.id}`,
      { method: "DELETE", accessToken: manager.accessToken },
    );
    expect(deleted.status).toBe(200);

    const listed = await apiJson<{ changeSets: ChangeSet[] }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets?status=suggested`,
      { accessToken: manager.accessToken },
    );
    expect(listed.body.changeSets).toEqual([]);
  });

  it("non-Manager cannot submit a Change Set", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const submitted = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: outsider.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "create_board",
              id: randomUUID(),
              name: "X",
              width: 1,
              height: 1,
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(400);
  });

  it("direct board and button writes are rejected", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const boardPost = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { name: "Side door" },
      },
    );
    expect(boardPost.status).toBe(410);

    const buttonPost = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${randomUUID()}/buttons`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { row_index: 0, col_index: 0 },
      },
    );
    expect(buttonPost.status).toBe(410);
  });

  it("multi-mutation Applied Change Set creates board and button together", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    const boardId = randomUUID();
    const buttonId = randomUUID();

    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "create_board",
              id: boardId,
              name: "Grid",
              width: 2,
              height: 2,
            },
            {
              op: "create_button",
              id: buttonId,
              board_id: boardId,
              row_index: 0,
              col_index: 1,
              label: "Hi",
              background_color: "#ff0000",
            },
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
    expect(buttons.status).toBe(200);
    expect(buttons.body.buttons).toEqual([
      expect.objectContaining({
        id: buttonId,
        label: "Hi",
        row_index: 0,
        col_index: 1,
        background_color: "#ff0000",
      }),
    ]);
  });

  it("vocabulary rename still works without Change Sets", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const renamed = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      {
        method: "PATCH",
        accessToken: manager.accessToken,
        body: { name: "Renamed" },
      },
    );
    expect(renamed.status).toBe(200);
    expect(renamed.body.vocabulary.name).toBe("Renamed");
  });

  it("deleting a vocabulary removes its Change Sets", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const submitted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "suggested",
          mutations: [
            {
              op: "create_board",
              id: randomUUID(),
              name: "Temp",
              width: 1,
              height: 1,
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);

    const deleted = await apiJson<{ ok: boolean }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { method: "DELETE", accessToken: manager.accessToken },
    );
    expect(deleted.status).toBe(200);

    const listed = await apiJson<{ changeSets?: ChangeSet[]; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      { accessToken: manager.accessToken },
    );
    expect(listed.body.changeSets ?? []).toEqual([]);
  });
});
