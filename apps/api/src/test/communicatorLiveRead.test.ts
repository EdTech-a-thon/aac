import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = {
  id: string;
  name: string;
  displayName: string;
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

async function addCommunicator(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  vocabularyId: string,
  email: string,
) {
  const added = await apiJson(app, `/vocabularies/${vocabularyId}/communicators`, {
    method: "POST",
    accessToken,
    body: { email },
  });
  expect(added.status).toBe(201);
}

describe("Communicator live Vocabulary read", () => {
  it("a Communicator can GET that Vocabulary by id", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(
      app,
      manager.accessToken,
      "Shared live",
    );
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const got = await apiJson<{ vocabulary: Vocabulary }>(
      app,
      `/vocabularies/${vocabulary.id}`,
      { accessToken: communicator.accessToken },
    );

    expect(got.status).toBe(200);
    expect(got.body.vocabulary).toEqual(
      expect.objectContaining({
        id: vocabulary.id,
        name: "Shared live",
        displayName: "Shared live",
      }),
    );
  });

  it("a Communicator can GET live Boards, Buttons, and Palette Colors", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const boardId = randomUUID();
    const buttonId = randomUUID();
    const submitted = await apiJson(app, `/vocabularies/${vocabulary.id}/change-sets`, {
      method: "POST",
      accessToken: manager.accessToken,
      body: {
        status: "applied",
        mutations: [
          { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
          {
            op: "create_button",
            id: buttonId,
            board_id: boardId,
            row_index: 0,
            col_index: 0,
            label: "Hi",
            action: { kind: "insert_phrase", phrase: "hello" },
          },
        ],
      },
    });
    expect(submitted.status).toBe(201);

    const boards = await apiJson<{ boards: { id: string; name: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/boards`,
      { accessToken: communicator.accessToken },
    );
    expect(boards.status).toBe(200);
    expect(boards.body.boards).toEqual([
      expect.objectContaining({ id: boardId, name: "Home", displayName: "Home" }),
    ]);

    const buttons = await apiJson<{
      buttons: { id: string; label: string; action: unknown }[];
    }>(app, `/vocabularies/${vocabulary.id}/boards/${boardId}/buttons`, {
      accessToken: communicator.accessToken,
    });
    expect(buttons.status).toBe(200);
    expect(buttons.body.buttons).toEqual([
      expect.objectContaining({
        id: buttonId,
        label: "Hi",
        action: { kind: "insert_phrase", phrase: "hello" },
      }),
    ]);

    const palette = await apiJson<{ paletteColors: { name: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/palette-colors`,
      { accessToken: communicator.accessToken },
    );
    expect(palette.status).toBe(200);
    expect(palette.body.paletteColors.length).toBeGreaterThan(0);
    expect(palette.body.paletteColors.some((c) => c.name === "Nouns")).toBe(true);
  });

  it("GET /vocabularies stays Management-only when the caller also has Usage on another Vocabulary", async () => {
    const app = testApp();
    const user = await createTestUser();
    const otherManager = await createTestUser();
    const managed = await createManagedVocabulary(app, user.accessToken, "Managed");
    const used = await createManagedVocabulary(app, otherManager.accessToken, "Used only");
    await addCommunicator(app, otherManager.accessToken, used.id, user.email);

    const listed = await apiJson<{ vocabularies: Vocabulary[] }>(app, "/vocabularies", {
      accessToken: user.accessToken,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.vocabularies.map((v) => v.id)).toEqual([managed.id]);
  });

  it("a User with only Usage does not see that Vocabulary in GET /vocabularies", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const listed = await apiJson<{ vocabularies: Vocabulary[] }>(app, "/vocabularies", {
      accessToken: communicator.accessToken,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.vocabularies).toEqual([]);
  });

  it("an outsider cannot read the Vocabulary by id", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const got = await apiJson<{ error: string }>(app, `/vocabularies/${vocabulary.id}`, {
      accessToken: outsider.accessToken,
    });
    expect(got.status).toBe(404);
  });

  it("a Communicator cannot GET Change Sets, Managers, or Communicators, or mutate", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const changeSets = await apiJson<{ changeSets?: unknown; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      { accessToken: communicator.accessToken },
    );
    expect(changeSets.status).toBe(400);

    const managers = await apiJson<{ managers?: unknown; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/managers`,
      { accessToken: communicator.accessToken },
    );
    expect(managers.status).toBe(400);

    const communicators = await apiJson<{ communicators?: unknown; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: communicator.accessToken },
    );
    expect(communicators.status).toBe(400);

    const renamed = await apiJson<{ error: string }>(app, `/vocabularies/${vocabulary.id}`, {
      method: "PATCH",
      accessToken: communicator.accessToken,
      body: { name: "Hijacked" },
    });
    expect(renamed.status).toBeGreaterThanOrEqual(400);

    const submitted = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: communicator.accessToken,
        body: {
          status: "applied",
          mutations: [{ op: "create_board", id: randomUUID(), name: "X", width: 1, height: 1 }],
        },
      },
    );
    expect(submitted.status).toBeGreaterThanOrEqual(400);
  });
});

describe("Communicator Usage list and live snapshot", () => {
  it("lists Vocabularies the caller has Usage for, alphabetically by displayName", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const banana = await createManagedVocabulary(app, manager.accessToken, "Banana");
    const untitled = await createManagedVocabulary(app, manager.accessToken, "");
    const apple = await createManagedVocabulary(app, manager.accessToken, "Apple");
    await addCommunicator(app, manager.accessToken, banana.id, communicator.email);
    await addCommunicator(app, manager.accessToken, untitled.id, communicator.email);
    await addCommunicator(app, manager.accessToken, apple.id, communicator.email);

    const managedOnly = await createManagedVocabulary(app, manager.accessToken, "Not shared");

    const listed = await apiJson<{ vocabularies: Vocabulary[] }>(app, "/vocabularies/using", {
      accessToken: communicator.accessToken,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.vocabularies.map((v) => v.displayName)).toEqual([
      "Apple",
      "Banana",
      "Untitled",
    ]);
    expect(listed.body.vocabularies.map((v) => v.id)).toEqual([
      apple.id,
      banana.id,
      untitled.id,
    ]);
    expect(listed.body.vocabularies.some((v) => v.id === managedOnly.id)).toBe(false);
  });

  it("returns a live snapshot for Usage, including revision and out-of-viewport Buttons", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Snap");
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const empty = await apiJson<{
      snapshot: { revision: number; boards: unknown[] };
    }>(app, `/vocabularies/${vocabulary.id}/live`, {
      accessToken: communicator.accessToken,
    });
    expect(empty.status).toBe(200);
    expect(empty.body.snapshot.revision).toBe(0);
    expect(empty.body.snapshot.boards).toEqual([]);

    const boardId = randomUUID();
    const inViewId = randomUUID();
    const outViewId = randomUUID();
    const submitted = await apiJson<{ changeSet: { applied_seq: number } }>(
      app,
      `/vocabularies/${vocabulary.id}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "applied",
          mutations: [
            { op: "create_board", id: boardId, name: "Home", width: 1, height: 1 },
            {
              op: "create_button",
              id: inViewId,
              board_id: boardId,
              row_index: 0,
              col_index: 0,
              label: "In",
              action: { kind: "speak_immediately", phrase: "hi" },
            },
            {
              op: "create_button",
              id: outViewId,
              board_id: boardId,
              row_index: 5,
              col_index: 5,
              label: "Out",
              action: { kind: "play_youtube_clip", video_id: "abcdefghijk", start: 0, end: 1 },
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);

    const live = await apiJson<{
      snapshot: {
        id: string;
        name: string;
        displayName: string;
        revision: number;
        paletteColors: { name: string }[];
        boards: {
          id: string;
          width: number;
          height: number;
          buttons: { id: string; label: string; action: unknown }[];
        }[];
      };
    }>(app, `/vocabularies/${vocabulary.id}/live`, {
      accessToken: communicator.accessToken,
    });
    expect(live.status).toBe(200);
    expect(live.body.snapshot.id).toBe(vocabulary.id);
    expect(live.body.snapshot.revision).toBe(1);
    expect(live.body.snapshot.paletteColors.some((c) => c.name === "Nouns")).toBe(true);
    expect(live.body.snapshot.boards).toHaveLength(1);
    const board = live.body.snapshot.boards[0];
    expect(board.buttons.map((b) => b.id).sort()).toEqual([inViewId, outViewId].sort());
    expect(board.buttons.find((b) => b.id === outViewId)?.label).toBe("Out");
    expect(board.buttons[0]).toHaveProperty("palette_color_id");
    expect(board.buttons[0]).toHaveProperty("background_color");
    expect("changeSets" in live.body.snapshot).toBe(false);
    expect("mutations" in live.body.snapshot).toBe(false);
  });

  it("a blank Vocabulary live snapshot has no Snippets", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(
      app,
      manager.accessToken,
      "Blank live",
    );
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const live = await apiJson<{
      snapshot: { boards: { id: string; kind?: string }[] };
    }>(app, `/vocabularies/${vocabulary.id}/live`, {
      accessToken: communicator.accessToken,
    });
    expect(live.status).toBe(200);
    expect(live.body.snapshot.boards).toEqual([]);
  });

  it("includes Snippets in the live snapshot with kind snippet", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Snips");
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const snippetId = randomUUID();
    const buttonId = randomUUID();
    const submitted = await apiJson(app, `/vocabularies/${vocabulary.id}/change-sets`, {
      method: "POST",
      accessToken: manager.accessToken,
      body: {
        status: "applied",
        mutations: [
          {
            op: "create_board",
            id: snippetId,
            name: "Common actions",
            width: 6,
            height: 1,
            kind: "snippet",
          },
          {
            op: "create_button",
            id: buttonId,
            board_id: snippetId,
            row_index: 0,
            col_index: 0,
            label: "Go",
            action: { kind: "insert_phrase", phrase: "go" },
          },
        ],
      },
    });
    expect(submitted.status).toBe(201);

    const live = await apiJson<{
      snapshot: {
        boards: {
          id: string;
          kind?: string;
          name: string;
          buttons: { id: string }[];
        }[];
      };
    }>(app, `/vocabularies/${vocabulary.id}/live`, {
      accessToken: communicator.accessToken,
    });
    expect(live.status).toBe(200);
    expect(live.body.snapshot.boards).toEqual([
      expect.objectContaining({
        id: snippetId,
        name: "Common actions",
        kind: "snippet",
      }),
    ]);
    expect(live.body.snapshot.boards[0]?.buttons.map((b) => b.id)).toEqual([buttonId]);
  });

  it("includes Snippet Inclusions in the live snapshot", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Live inc");
    await addCommunicator(app, manager.accessToken, vocabulary.id, communicator.email);

    const homeId = randomUUID();
    const snippetId = randomUUID();
    const inclusionId = randomUUID();
    const submitted = await apiJson(app, `/vocabularies/${vocabulary.id}/change-sets`, {
      method: "POST",
      accessToken: manager.accessToken,
      body: {
        status: "applied",
        mutations: [
          { op: "create_board", id: homeId, name: "Home", width: 4, height: 2 },
          {
            op: "create_board",
            id: snippetId,
            name: "Strip",
            width: 2,
            height: 1,
            kind: "snippet",
          },
          {
            op: "create_snippet_inclusion",
            id: inclusionId,
            host_id: homeId,
            snippet_id: snippetId,
            origin_row: 0,
            origin_col: 1,
          },
        ],
      },
    });
    expect(submitted.status).toBe(201);

    const live = await apiJson<{
      snapshot: {
        boards: { id: string; kind?: string }[];
        snippetInclusions: {
          id: string;
          host_id: string;
          snippet_id: string;
          origin_row: number;
          origin_col: number;
        }[];
      };
    }>(app, `/vocabularies/${vocabulary.id}/live`, {
      accessToken: communicator.accessToken,
    });
    expect(live.status).toBe(200);
    expect(live.body.snapshot.boards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: homeId, kind: "board" }),
        expect.objectContaining({ id: snippetId, kind: "snippet" }),
      ]),
    );
    expect(live.body.snapshot.snippetInclusions).toEqual([
      expect.objectContaining({
        id: inclusionId,
        host_id: homeId,
        snippet_id: snippetId,
        origin_row: 0,
        origin_col: 1,
      }),
    ]);
  });

  it("denies the live snapshot without Usage, including Management-only", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const asManager = await apiJson<{ error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/live`,
      { accessToken: manager.accessToken },
    );
    expect(asManager.status).toBeGreaterThanOrEqual(400);

    const asOutsider = await apiJson<{ error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/live`,
      { accessToken: outsider.accessToken },
    );
    expect(asOutsider.status).toBeGreaterThanOrEqual(400);
  });
});
