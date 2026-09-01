import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.js";

type Vocabulary = {
  id: string;
  name: string;
  displayName: string;
};

type LiveResponse = {
  snapshot: {
    boards: { id: string }[];
    paletteColors: { id: string }[];
  };
};

type Member = { userId: string; email: string | null };

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

async function addManager(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  vocabularyId: string,
  email: string,
) {
  const added = await apiJson(app, `/vocabularies/${vocabularyId}/managers`, {
    method: "POST",
    accessToken,
    body: { email },
  });
  expect(added.status).toBe(201);
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

function listUsing(app: ReturnType<typeof testApp>, accessToken: string) {
  return apiJson<{ vocabularies: Vocabulary[] }>(app, "/vocabularies/using", {
    accessToken,
  });
}

function readLive(
  app: ReturnType<typeof testApp>,
  accessToken: string,
  vocabularyId: string,
) {
  return apiJson<LiveResponse>(app, `/vocabularies/${vocabularyId}/live`, {
    accessToken,
  });
}

describe("Management entails Usage", () => {
  it("lets a Manager holding no Usage relationship read the live Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Mine");

    const live = await readLive(app, manager.accessToken, vocabulary.id);

    expect(live.status).toBe(200);
    expect(live.body.snapshot.paletteColors.length).toBeGreaterThan(0);
  });

  it("lists a Vocabulary a User manages among the ones they can communicate with", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Managed only");

    const using = await listUsing(app, manager.accessToken);

    expect(using.status).toBe(200);
    expect(using.body.vocabularies.map((entry) => entry.id)).toContain(vocabulary.id);
  });

  it("still refuses a User who neither manages nor uses the Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const stranger = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken, "Private");

    const live = await readLive(app, stranger.accessToken, vocabulary.id);
    const using = await listUsing(app, stranger.accessToken);

    expect(live.status).toBe(404);
    expect(using.body.vocabularies.map((entry) => entry.id)).not.toContain(vocabulary.id);
  });

  it("keeps a Manager's access when their explicit Usage relationship is removed", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const other = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, owner.accessToken, "Both roles");
    await addManager(app, owner.accessToken, vocabulary.id, other.email);
    await addCommunicator(app, owner.accessToken, vocabulary.id, other.email);

    const removed = await apiJson(
      app,
      `/vocabularies/${vocabulary.id}/communicators/${other.userId}`,
      { method: "DELETE", accessToken: owner.accessToken },
    );
    expect(removed.status).toBe(200);

    const live = await readLive(app, other.accessToken, vocabulary.id);
    expect(live.status).toBe(200);
  });

  it("takes access away when the Management relationship itself is removed", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const other = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, owner.accessToken, "Demoted");
    await addManager(app, owner.accessToken, vocabulary.id, other.email);

    expect((await readLive(app, other.accessToken, vocabulary.id)).status).toBe(200);

    const removed = await apiJson(
      app,
      `/vocabularies/${vocabulary.id}/managers/${other.userId}`,
      { method: "DELETE", accessToken: owner.accessToken },
    );
    expect(removed.status).toBe(200);

    const live = await readLive(app, other.accessToken, vocabulary.id);
    expect(live.status).toBe(404);
  });

  it("leaves Managers out of the Communicators list unless they hold an explicit relationship", async () => {
    const app = testApp();
    const owner = await createTestUser();
    const managerOnly = await createTestUser();
    const bothRoles = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, owner.accessToken, "Lists");
    await addManager(app, owner.accessToken, vocabulary.id, managerOnly.email);
    await addManager(app, owner.accessToken, vocabulary.id, bothRoles.email);
    await addCommunicator(app, owner.accessToken, vocabulary.id, bothRoles.email);

    const listed = await apiJson<{ communicators: Member[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: owner.accessToken },
    );

    expect(listed.status).toBe(200);
    const ids = listed.body.communicators.map((member) => member.userId);
    expect(ids).toContain(bothRoles.userId);
    expect(ids).not.toContain(managerOnly.userId);
    expect(ids).not.toContain(owner.userId);
  });
});
