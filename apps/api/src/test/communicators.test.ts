import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string; name: string };
type Communicator = {
  userId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
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

describe("Communicator Usage HTTP API", () => {
  it("Manager can add a Communicator by email", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const peer = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const added = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );

    expect(added.status).toBe(201);
    const communicator = added.body.communicators.find((c) => c.userId === peer.userId);
    expect(communicator).toBeDefined();
    expect(communicator?.email).toBe(peer.email);
  });

  it("adding a Communicator fails when no User has that email", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const added = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: "nobody-exists@example.com" },
      },
    );

    expect(added.status).toBe(404);
    expect(added.body.error.toLowerCase()).toContain("no user found");
  });

  it("re-adding an existing Communicator succeeds without duplicating", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const peer = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const first = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(first.status).toBe(201);

    const second = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(second.status).toBe(201);
    expect(
      second.body.communicators.filter((c) => c.userId === peer.userId),
    ).toHaveLength(1);
  });

  it("creating a Vocabulary does not create Usage", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const listed = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: manager.accessToken },
    );

    expect(listed.status).toBe(200);
    expect(listed.body.communicators).toEqual([]);
  });

  it("a Manager can also be a Communicator of the same Vocabulary", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const added = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: manager.email },
      },
    );
    expect(added.status).toBe(201);
    expect(added.body.communicators.some((c) => c.userId === manager.userId)).toBe(
      true,
    );

    const managers = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/managers`,
      { accessToken: manager.accessToken },
    );
    expect(managers.status).toBe(200);
    expect(managers.body.managers.some((m) => m.userId === manager.userId)).toBe(
      true,
    );
  });

  it("a Manager can remove the last Communicator without affecting Management", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const peer = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const added = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(added.status).toBe(201);

    const removed = await apiJson<{ ok: boolean }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators/${peer.userId}`,
      { method: "DELETE", accessToken: manager.accessToken },
    );
    expect(removed.status).toBe(200);

    const listed = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: manager.accessToken },
    );
    expect(listed.status).toBe(200);
    expect(listed.body.communicators).toEqual([]);

    const managers = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/managers`,
      { accessToken: manager.accessToken },
    );
    expect(managers.status).toBe(200);
    expect(managers.body.managers.some((m) => m.userId === manager.userId)).toBe(
      true,
    );
  });

  it("removing Management leaves Usage in place", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const peer = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const asManager = await apiJson<{ managers: { userId: string }[] }>(
      app,
      `/vocabularies/${vocabulary.id}/managers`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(asManager.status).toBe(201);

    const asCommunicator = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(asCommunicator.status).toBe(201);

    const removed = await apiJson<{ ok: boolean }>(
      app,
      `/vocabularies/${vocabulary.id}/managers/${peer.userId}`,
      { method: "DELETE", accessToken: manager.accessToken },
    );
    expect(removed.status).toBe(200);

    const listed = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: manager.accessToken },
    );
    expect(listed.status).toBe(200);
    expect(listed.body.communicators.some((c) => c.userId === peer.userId)).toBe(
      true,
    );
  });

  it("non-Managers cannot list, add, or remove Communicators", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const outsider = await createTestUser();
    const peer = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const listed = await apiJson<{ communicators?: Communicator[]; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: outsider.accessToken },
    );
    expect(listed.status).toBe(400);

    const added = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: outsider.accessToken,
        body: { email: peer.email },
      },
    );
    expect(added.status).toBe(400);

    const seeded = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: peer.email },
      },
    );
    expect(seeded.status).toBe(201);

    const removed = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators/${peer.userId}`,
      { method: "DELETE", accessToken: outsider.accessToken },
    );
    expect(removed.status).toBe(400);

    const stillThere = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: manager.accessToken },
    );
    expect(stillThere.body.communicators.some((c) => c.userId === peer.userId)).toBe(
      true,
    );
  });

  it("a Communicator cannot list, add, or remove Communicators", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const communicator = await createTestUser();
    const other = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const seeded = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: communicator.email },
      },
    );
    expect(seeded.status).toBe(201);

    const seededOther = await apiJson<{ communicators: Communicator[] }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: { email: other.email },
      },
    );
    expect(seededOther.status).toBe(201);

    const listed = await apiJson<{ communicators?: Communicator[]; error?: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      { accessToken: communicator.accessToken },
    );
    expect(listed.status).toBe(400);

    const added = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators`,
      {
        method: "POST",
        accessToken: communicator.accessToken,
        body: { email: other.email },
      },
    );
    expect(added.status).toBe(400);

    const removed = await apiJson<{ error: string }>(
      app,
      `/vocabularies/${vocabulary.id}/communicators/${communicator.userId}`,
      { method: "DELETE", accessToken: communicator.accessToken },
    );
    expect(removed.status).toBe(400);
  });
});
