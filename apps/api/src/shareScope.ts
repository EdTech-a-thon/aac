/**
 * What a Board Share Link exposes, and nothing more: the Board, the Snippets
 * it needs to draw itself, the Buttons on all of those, and the Palette Colors
 * those Buttons are bound to.
 *
 * A Board must not become a way to enumerate the Boards it links to, so an
 * Open Board Action whose target is outside the share is cleared rather than
 * passed on — the target's identifier never leaves. See ADR 0010.
 */

type Grid = { id: string; kind: "board" | "snippet" };
type Btn = {
  id: string;
  board_id: string;
  palette_color_id: string | null;
  action: Record<string, unknown> | null;
};
type Inc = { id: string; host_id: string; snippet_id: string };
type Color = { id: string };

export function scopeBoardShare<
  G extends Grid,
  B extends Btn,
  I extends Inc,
  C extends Color,
>(input: {
  boards: G[];
  buttons: B[];
  snippetInclusions: I[];
  paletteColors: C[];
  boardId: string;
}): { boards: G[]; buttons: B[]; snippetInclusions: I[]; paletteColors: C[] } | null {
  // Only a Board can be shared. A Snippet is never a destination.
  const root = input.boards.find(
    (grid) => grid.id === input.boardId && grid.kind !== "snippet",
  );
  if (!root) return null;

  // Everything needed to render, following inclusions as far as they go. A
  // cycle cannot be created through the manager app, but it must not hang
  // this route if one ever exists.
  const inScope = new Set<string>([root.id]);
  const queue = [root.id];
  while (queue.length) {
    const hostId = queue.shift()!;
    for (const inclusion of input.snippetInclusions) {
      if (inclusion.host_id === hostId && !inScope.has(inclusion.snippet_id)) {
        inScope.add(inclusion.snippet_id);
        queue.push(inclusion.snippet_id);
      }
    }
  }

  const boards = input.boards.filter((grid) => inScope.has(grid.id));
  const snippetInclusions = input.snippetInclusions.filter((inclusion) =>
    inScope.has(inclusion.host_id),
  );

  const buttons = input.buttons
    .filter((button) => inScope.has(button.board_id))
    .map((button) => {
      const action = button.action;
      if (
        action?.kind === "open_board" &&
        typeof action.board_id === "string" &&
        !inScope.has(action.board_id)
      ) {
        return { ...button, action: null };
      }
      return button;
    });

  const boundColorIds = new Set(
    buttons
      .map((button) => button.palette_color_id)
      .filter((id): id is string => id !== null),
  );
  const paletteColors = input.paletteColors.filter((color) => boundColorIds.has(color.id));

  return { boards, buttons, snippetInclusions, paletteColors };
}
