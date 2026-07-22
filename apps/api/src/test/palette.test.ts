import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = {
  id: string;
  name: string;
  displayName: string;
};

type PaletteColor = {
  id: string;
  vocabulary_id: string;
  hex: string;
  name: string;
  description: string;
  position: number;
};

describe("Vocabulary Initial Snapshot Palette", () => {
  it("seeds a Fitzgerald-default Palette on create", async () => {
    const user = await createTestUser();
    const app = testApp();

    const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
      method: "POST",
      accessToken: user.accessToken,
      body: { name: "Palette seed" },
    });
    expect(created.status).toBe(201);

    const palette = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${created.body.vocabulary.id}/palette-colors`,
      { accessToken: user.accessToken },
    );
    expect(palette.status).toBe(200);
    expect(palette.body.paletteColors).toHaveLength(10);
    expect(palette.body.paletteColors.map((c) => c.name)).toEqual([
      "Conjunctions",
      "Pronouns",
      "Verbs",
      "Nouns",
      "Adjectives",
      "Prepositions / social",
      "Questions",
      "Adverbs",
      "Negation / emergency",
      "Determiners",
    ]);
    expect(palette.body.paletteColors[3]).toEqual(
      expect.objectContaining({
        name: "Nouns",
        hex: "#ffb74d",
        description: "People, places, things, and ideas you name",
        position: 3,
      }),
    );
  });
});
