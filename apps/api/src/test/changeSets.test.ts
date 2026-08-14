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
  kind?: "board" | "snippet";
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
  background_color: string;
  action: ButtonAction | null;
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

  it("Manager can create a Snippet and cannot Open Board to it", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "CS Snippet");

    const snippetId = randomUUID();
    const homeId = randomUUID();
    const buttonId = randomUUID();
    const created = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            { op: "create_board", id: homeId, name: "Home", width: 2, height: 2 },
            {
              op: "create_board",
              id: snippetId,
              name: "Strip",
              width: 6,
              height: 1,
              kind: "snippet",
            },
          ],
        },
      },
    );
    expect(created.status).toBe(201);

    const boards = await apiJson<{ boards: Board[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: manager.accessToken },
    );
    expect(boards.status).toBe(200);
    expect(boards.body.boards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: homeId, kind: "board" }),
        expect.objectContaining({ id: snippetId, name: "Strip", kind: "snippet" }),
      ]),
    );

    const rejected = await apiJson<{ error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "create_button",
              id: buttonId,
              board_id: homeId,
              row_index: 0,
              col_index: 0,
              label: "Go",
              action: { kind: "open_board", board_id: snippetId },
            },
          ],
        },
      },
    );
    expect(rejected.status).toBeGreaterThanOrEqual(400);
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

  it("non-Manager cannot submit, apply, or delete a Change Set", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const submitted = await apiJson<{ changeSet: ChangeSet; error?: string }>(
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

    const suggested = await apiJson<{ changeSet: ChangeSet }>(
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
              name: "Pending",
              width: 1,
              height: 1,
            },
          ],
        },
      },
    );
    expect(suggested.status).toBe(201);

    const apply = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets/${suggested.body.changeSet.id}/apply`,
      { method: "POST", accessToken: outsider.accessToken },
    );
    expect(apply.status).toBe(400);

    const del = await apiJson<{ error?: string; ok?: boolean }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets/${suggested.body.changeSet.id}`,
      { method: "DELETE", accessToken: outsider.accessToken },
    );
    expect(del.status).toBe(404);
  });

  it("managers can still be added without Change Sets", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const peer = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const added = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/managers`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(added.status).toBe(201);
    expect(added.body.managers.some((m) => m.userId === peer.userId)).toBe(true);
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

  it("applying a position suggestion last-write-wins absolute (row, col)", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    const boardId = randomUUID();
    const buttonId = randomUUID();

    const seeded = await apiJson<{ changeSet: ChangeSet }>(
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
              width: 3,
              height: 3,
            },
            {
              op: "create_button",
              id: buttonId,
              board_id: boardId,
              row_index: 0,
              col_index: 0,
              label: "Tile",
              background_color: "#FFFFFF",
            },
          ],
        },
      },
    );
    expect(seeded.status).toBe(201);

    // Suggest moving down to (1, 0) — both axes stored as absolute position.
    const suggestion = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "suggested",
          mutations: [
            {
              op: "update_button",
              id: buttonId,
              row_index: 1,
              col_index: 0,
            },
          ],
        },
      },
    );
    expect(suggestion.status).toBe(201);

    // Meanwhile, apply a move right to (0, 1).
    const intervening = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "update_button",
              id: buttonId,
              row_index: 0,
              col_index: 1,
            },
          ],
        },
      },
    );
    expect(intervening.status).toBe(201);

    const applied = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets/${suggestion.body.changeSet.id}/apply`,
      { method: "POST", accessToken: manager.accessToken },
    );
    expect(applied.status).toBe(200);

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.status).toBe(200);
    expect(buttons.body.buttons).toEqual([
      expect.objectContaining({
        id: buttonId,
        row_index: 1,
        col_index: 0,
      }),
    ]);
  });

  it("Applied Change Set can create a Button with an Insert Phrase Action", async () => {
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
              col_index: 0,
              label: "Hi",
              background_color: "#FFFFFF",
              action: { kind: "insert_phrase", phrase: "hello" },
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
        action: { kind: "insert_phrase", phrase: "hello" },
      }),
    ]);
  });

  it("deleting a Board clears Open Board Actions that targeted it", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    const homeId = randomUUID();
    const foodsId = randomUUID();
    const buttonId = randomUUID();

    const seeded = await apiJson<{ changeSet: ChangeSet }>(
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
              id: homeId,
              name: "Home",
              width: 2,
              height: 2,
            },
            {
              op: "create_board",
              id: foodsId,
              name: "Foods",
              width: 2,
              height: 2,
            },
            {
              op: "create_button",
              id: buttonId,
              board_id: homeId,
              row_index: 0,
              col_index: 0,
              label: "Foods",
              background_color: "#FFFFFF",
              action: { kind: "open_board", board_id: foodsId },
            },
          ],
        },
      },
    );
    expect(seeded.status).toBe(201);

    const deleted = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [{ op: "delete_board", id: foodsId }],
        },
      },
    );
    expect(deleted.status).toBe(201);

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${homeId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.status).toBe(200);
    expect(buttons.body.buttons).toEqual([
      expect.objectContaining({
        id: buttonId,
        action: null,
      }),
    ]);
  });

  it("update_button can set and clear a Button Action", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    const boardId = randomUUID();
    const buttonId = randomUUID();

    const seeded = await apiJson<{ changeSet: ChangeSet }>(
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
              col_index: 0,
              label: "Hi",
              background_color: "#FFFFFF",
            },
          ],
        },
      },
    );
    expect(seeded.status).toBe(201);

    const setAction = await apiJson<{ changeSet: ChangeSet; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "update_button",
              id: buttonId,
              action: { kind: "speak_immediately", phrase: "hello" },
            },
          ],
        },
      },
    );
    expect(setAction.status).toBe(201);

    let buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.body.buttons).toEqual([
      expect.objectContaining({
        id: buttonId,
        action: { kind: "speak_immediately", phrase: "hello" },
      }),
    ]);

    const clearAction = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            {
              op: "update_button",
              id: buttonId,
              action: null,
            },
          ],
        },
      },
    );
    expect(clearAction.status).toBe(201);

    buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.body.buttons).toEqual([
      expect.objectContaining({
        id: buttonId,
        action: null,
      }),
    ]);
  });

  it("rejects Insert Phrase with a blank phrase", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    const boardId = randomUUID();
    const buttonId = randomUUID();

    const submitted = await apiJson<{ changeSet?: ChangeSet; error?: string }>(
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
              col_index: 0,
              label: "Hi",
              background_color: "#FFFFFF",
              action: { kind: "insert_phrase", phrase: "   " },
            },
          ],
        },
      },
    );
    expect(submitted.status).toBeGreaterThanOrEqual(400);
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
