import { randomUUID } from "node:crypto";

export type CopyGrid = {
  id: string;
  name: string;
  width: number;
  height: number;
  kind?: "board" | "snippet";
  created_at?: string;
};

export type CopyButton = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string | null;
  palette_color_id: string | null;
  action: Record<string, unknown> | null;
  symbol_digest?: string | null;
  created_at?: string;
};

export type CopyPaletteColor = {
  id: string;
  hex: string;
  name: string;
  description: string;
  position: number;
};

export type CopyInclusion = {
  id: string;
  host_id: string;
  snippet_id: string;
  origin_row: number;
  origin_col: number;
  created_at?: string;
};

export type VocabularyCopySnapshot = {
  boards: CopyGrid[];
  buttons: CopyButton[];
  palette_colors: CopyPaletteColor[];
  snippet_inclusions: CopyInclusion[];
};

function byCreation(a: { created_at?: string; id: string }, b: { created_at?: string; id: string }) {
  const time = (a.created_at ?? "").localeCompare(b.created_at ?? "");
  return time || a.id.localeCompare(b.id);
}

export function remapVocabularySnapshot(source: VocabularyCopySnapshot) {
  const gridIds = new Map(source.boards.map((grid) => [grid.id, randomUUID()]));
  const colorIds = new Map(source.palette_colors.map((color) => [color.id, randomUUID()]));

  const palette_colors = source.palette_colors
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((color) => ({ ...color, id: colorIds.get(color.id)! }));
  const boards = source.boards.slice().sort(byCreation).map((grid) => ({
    id: gridIds.get(grid.id)!,
    name: grid.name,
    width: grid.width,
    height: grid.height,
    kind: grid.kind === "snippet" ? "snippet" : "board",
  }));
  const buttons = source.buttons.slice().sort(byCreation).map((button) => {
    let action = button.action;
    if (action?.kind === "open_board" && typeof action.board_id === "string") {
      // Every Board is copied, so a target should always resolve. If one does
      // not, drop the Action rather than persist an Open Board with no target:
      // CONTEXT.md says an incomplete Action is not persisted at all.
      const copiedTarget = gridIds.get(action.board_id);
      action = copiedTarget ? { ...action, board_id: copiedTarget } : null;
    }
    return {
      id: randomUUID(),
      board_id: gridIds.get(button.board_id)!,
      row_index: button.row_index,
      col_index: button.col_index,
      label: button.label,
      background_color: button.background_color,
      palette_color_id: button.palette_color_id
        ? (colorIds.get(button.palette_color_id) ?? null)
        : null,
      action,
      symbol_digest: button.symbol_digest ?? null,
    };
  });
  const snippet_inclusions = source.snippet_inclusions.slice().sort(byCreation).map((inc) => ({
    id: randomUUID(),
    host_id: gridIds.get(inc.host_id)!,
    snippet_id: gridIds.get(inc.snippet_id)!,
    origin_row: inc.origin_row,
    origin_col: inc.origin_col,
  }));
  const initialSnapshot = { boards, buttons, palette_colors, snippet_inclusions };
  const mutations = [
    ...palette_colors.map((color) => ({ op: "create_palette_color", ...color })),
    ...boards.map((board) => ({ op: "create_board", ...board })),
    ...buttons.map((button) => ({ op: "create_button", ...button })),
    ...snippet_inclusions.map((inc) => ({ op: "create_snippet_inclusion", ...inc })),
  ];
  return { initialSnapshot, mutations };
}

export function prepareBoardCopy(
  source: VocabularyCopySnapshot,
  sourceVocabularyId: string,
  destinationVocabularyId: string,
  sourceBoardId: string,
  name: string,
) {
  const root = source.boards.find((grid) => grid.id === sourceBoardId && grid.kind !== "snippet");
  if (!root) throw new Error("Board not found");
  const crossVocabulary = sourceVocabularyId !== destinationVocabularyId;
  const copiedIds = new Set([sourceBoardId]);
  if (crossVocabulary) {
    const queue = [sourceBoardId];
    while (queue.length) {
      const hostId = queue.shift()!;
      for (const inclusion of source.snippet_inclusions.filter((item) => item.host_id === hostId)) {
        if (!copiedIds.has(inclusion.snippet_id)) {
          copiedIds.add(inclusion.snippet_id);
          queue.push(inclusion.snippet_id);
        }
      }
    }
  }
  const gridsToCreate = source.boards.filter((grid) => copiedIds.has(grid.id)).sort(byCreation);
  const gridIds = new Map(gridsToCreate.map((grid) => [grid.id, randomUUID()]));
  const targetNameById = new Map(source.boards.map((grid) => [grid.id, grid.name]));
  const hexByColorId = new Map(source.palette_colors.map((color) => [color.id, color.hex]));
  const warnings: { button_id: string; previous_board_name: string }[] = [];
  const boards = gridsToCreate.map((grid) => ({
    op: "create_board",
    id: gridIds.get(grid.id)!,
    name: grid.id === sourceBoardId ? name : grid.name,
    width: grid.width,
    height: grid.height,
    kind: grid.kind === "snippet" ? "snippet" : "board",
  }));
  const buttons = source.buttons
    .filter((button) => copiedIds.has(button.board_id))
    .sort(byCreation)
    .map((button) => {
      const id = randomUUID();
      let action = button.action;
      if (action?.kind === "open_board" && typeof action.board_id === "string") {
        if (action.board_id === sourceBoardId) {
          action = { ...action, board_id: gridIds.get(sourceBoardId)! };
        } else if (crossVocabulary) {
          warnings.push({
            button_id: id,
            previous_board_name: targetNameById.get(action.board_id) ?? "",
          });
          action = null;
        }
      }
      const frozenHex = crossVocabulary && button.palette_color_id
        ? (hexByColorId.get(button.palette_color_id) ?? null)
        : button.background_color;
      return {
        op: "create_button",
        id,
        board_id: gridIds.get(button.board_id)!,
        row_index: button.row_index,
        col_index: button.col_index,
        label: button.label,
        background_color: frozenHex,
        palette_color_id: crossVocabulary ? null : button.palette_color_id,
        action,
        symbol_digest: button.symbol_digest ?? null,
      };
    });
  const inclusions = source.snippet_inclusions
    .filter((inc) => inc.host_id === sourceBoardId || (crossVocabulary && copiedIds.has(inc.host_id)))
    .sort(byCreation)
    .map((inc) => ({
      op: "create_snippet_inclusion",
      id: randomUUID(),
      host_id: gridIds.get(inc.host_id)!,
      snippet_id: crossVocabulary ? gridIds.get(inc.snippet_id)! : inc.snippet_id,
      origin_row: inc.origin_row,
      origin_col: inc.origin_col,
    }));
  return {
    boardId: gridIds.get(sourceBoardId)!,
    mutations: [...boards, ...buttons, ...inclusions],
    warnings,
  };
}
