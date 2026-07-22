import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiJson, createTestUser, testApp } from "./helpers.ts";

type Vocabulary = { id: string };
type Board = { id: string };
type PaletteColor = { id: string; name: string; hex: string };
type Button = {
  id: string;
  background_color: string | null;
  palette_color_id: string | null;
};

describe("Button color binding", () => {
  it("creates unset Buttons and binds to a Palette Color", async () => {
    const app = testApp();
    const manager = await createTestUser();
    const created = await apiJson<{ vocabulary: Vocabulary }>(app, "/vocabularies", {
      method: "POST",
      accessToken: manager.accessToken,
      body: { name: "Color bind" },
    });
    expect(created.status).toBe(201);
    const vocabularyId = created.body.vocabulary.id;

    const palette = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabularyId}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    const nouns = palette.body.paletteColors.find((c) => c.name === "Nouns")!;
    expect(nouns).toBeTruthy();

    const boardId = randomUUID();
    const unsetId = randomUUID();
    const boundId = randomUUID();

    const submitted = await apiJson(app, `/vocabularies/${vocabularyId}/change-sets`, {
      method: "POST",
      accessToken: manager.accessToken,
      body: {
        status: "applied",
        mutations: [
          { op: "create_board", id: boardId, name: "Home", width: 2, height: 2 },
          {
            op: "create_button",
            id: unsetId,
            board_id: boardId,
            row_index: 0,
            col_index: 0,
            label: "Unset",
          },
          {
            op: "create_button",
            id: boundId,
            board_id: boardId,
            row_index: 0,
            col_index: 1,
            label: "Noun",
            palette_color_id: nouns.id,
          },
        ],
      },
    });
    expect(submitted.status).toBe(201);

    const buttons = await apiJson<{ buttons: Button[] }>(
      app,
      `/vocabularies/${vocabularyId}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    expect(buttons.status).toBe(200);
    const unset = buttons.body.buttons.find((b) => b.id === unsetId)!;
    const bound = buttons.body.buttons.find((b) => b.id === boundId)!;
    expect(unset.background_color).toBeNull();
    expect(unset.palette_color_id).toBeNull();
    expect(bound.palette_color_id).toBe(nouns.id);
    expect(bound.background_color).toBeNull();

    // Changing Palette hex should not rewrite button rows; binding still points at the color.
    const recolor = await apiJson(app, `/vocabularies/${vocabularyId}/change-sets`, {
      method: "POST",
      accessToken: manager.accessToken,
      body: {
        status: "applied",
        mutations: [{ op: "update_palette_color", id: nouns.id, hex: "#aabbcc" }],
      },
    });
    expect(recolor.status).toBe(201);

    const after = await apiJson<{ buttons: Button[]; paletteColors?: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabularyId}/boards/${boardId}/buttons`,
      { accessToken: manager.accessToken },
    );
    const boundAfter = after.body.buttons.find((b) => b.id === boundId)!;
    expect(boundAfter.palette_color_id).toBe(nouns.id);

    const paletteAfter = await apiJson<{ paletteColors: PaletteColor[] }>(
      app,
      `/vocabularies/${vocabularyId}/palette-colors`,
      { accessToken: manager.accessToken },
    );
    expect(paletteAfter.body.paletteColors.find((c) => c.id === nouns.id)?.hex).toBe("#aabbcc");
  });
});
