import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string };
type PaletteColor = { id: string; name: string; hex: string };
type Button = {
  id: string;
  background_color: string | null;
  palette_color_id: string | null;
};
type ChangeSet = { id: string; status: string };

describe("Delete Palette Color freezes remaining bindings", () => {
  it("freezes Buttons to custom hex when a Suggested delete is Applied after bindings appear", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
      method: "POST",
      accessToken: manager.accessToken,
      body: { name: "Freeze delete" },
    });
    const vocabularyId = created.body.vocabulary.id;

    const palette = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabularyId}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    const adverbs = palette.body.paletteColors.find((c) => c.name === "Adverbs")!;
    expect(adverbs).toBeTruthy();

    // Suggest delete while unused.
    const suggested = await apiJson<{ changeSet: ChangeSet }>(
      app,
      `/vocabularies/${vocabularyId}/change-sets`,
      {
        method: "POST",
        accessToken: manager.accessToken,
        body: {
          status: "suggested",
          mutations: [{ op: "delete_palette_color", id: adverbs.id }],
        },
      },
    );
    expect(suggested.status).toBe(201);

    // Bind a Button to that color before applying the suggestion.
    const boardId = randomUUID();
    const buttonId = randomUUID();
    const bind = await apiJson(app, `/vocabularies/${vocabularyId}/change-sets`, {
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
            label: "slowly",
            palette_color_id: adverbs.id,
          },
        ],
      },
    });
    expect(bind.status).toBe(201);

    const applied = await apiJson(
      app,
      `/vocabularies/${vocabularyId}/change-sets/${suggested.body.changeSet.id}/apply`,
      { method: "POST", accessToken: manager.accessToken },
    );
    expect(applied.status).toBe(200);

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabularyId}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.body.buttons[0]).toEqual(
      expect.objectContaining({
        id: buttonId,
        palette_color_id: null,
        background_color: adverbs.hex.toLowerCase(),
      }),
    );

    const afterPalette = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabularyId}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    expect(afterPalette.body.paletteColors.find((c) => c.id === adverbs.id)).toBeUndefined();
  });
});
