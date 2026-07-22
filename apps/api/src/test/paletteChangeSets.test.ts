import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string; name: string };
type PaletteColor = {
  id: string;
  hex: string;
  name: string;
  description: string;
  position: number;
};
type ChangeSet = {
  id: string;
  status: "applied" | "suggested";
  applied_seq: number | null;
};

async function createManagedVocabulary(
  app: ReturnType<typeof testApp>,
  accessToken: string,
) {
  const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
    method: "POST",
    accessToken,
    body: { name: "Palette CS" },
  });
  expect(created.status).toBe(201);
  return created.body.vocabulary;
}

describe("Palette Change Set mutations", () => {
  it("applies create, update, and delete Palette Color mutations", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const vocabulary = await createManagedVocabulary(app, manager.accessToken);

    const before = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabulary.id}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    expect(before.body.paletteColors).toHaveLength(10);
    const nouns = before.body.paletteColors.find((c) => c.name === "Nouns");
    expect(nouns).toBeTruthy();

    const newId = randomUUID();
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
              op: "update_palette_color",
              id: nouns!.id,
              name: "Things",
              hex: "#ff9900",
            },
            {
              op: "create_palette_color",
              id: newId,
              hex: "#112233",
              name: "Custom",
              description: "A custom meaning",
              position: 10,
            },
            {
              op: "delete_palette_color",
              id: before.body.paletteColors.find((c) => c.name === "Adverbs")!.id,
            },
          ],
        },
      },
    );
    expect(submitted.status).toBe(201);
    expect(submitted.body.changeSet.status).toBe("applied");

    const after = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabulary.id}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    expect(after.status).toBe(200);
    expect(after.body.paletteColors).toHaveLength(10);
    expect(after.body.paletteColors.find((c) => c.id === nouns!.id)).toEqual(
      expect.objectContaining({
        name: "Things",
        hex: "#ff9900",
      }),
    );
    expect(after.body.paletteColors.find((c) => c.id === newId)).toEqual(
      expect.objectContaining({
        name: "Custom",
        hex: "#112233",
        description: "A custom meaning",
        position: 10,
      }),
    );
    expect(after.body.paletteColors.find((c) => c.name === "Adverbs")).toBeUndefined();
  });
});
