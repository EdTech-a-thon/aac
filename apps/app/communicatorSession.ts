export type ButtonAction =
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

export type LiveButton = {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label: string;
  background_color: string | null;
  palette_color_id: string | null;
  action: ButtonAction | null;
  symbol_digest: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveBoard = {
  id: string;
  vocabulary_id: string;
  name: string;
  displayName: string;
  width: number;
  height: number;
  kind?: "board" | "snippet";
  created_at: string;
  updated_at: string;
  buttons: LiveButton[];
};

export type LivePaletteColor = {
  id: string;
  vocabulary_id: string;
  hex: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type LiveSnapshot = {
  id: string;
  name: string;
  displayName: string;
  revision: number;
  paletteColors: LivePaletteColor[];
  boards: LiveBoard[];
  snippetInclusions: LiveSnippetInclusion[];
};

export type LiveSnippetInclusion = {
  id: string;
  host_id: string;
  snippet_id: string;
  origin_row: number;
  origin_col: number;
  created_at: string;
  updated_at: string;
};

export type SpeechAdapter = {
  speak(text: string): void;
  cancel(): void;
};

export type VisibleCell = {
  button: LiveButton;
  backgroundHex: string;
};

export type CommunicatorPhase = "idle" | "empty-vocabulary" | "board";

export type CommunicatorState = {
  phase: CommunicatorPhase;
  snapshot: LiveSnapshot | null;
  currentBoard: LiveBoard | null;
  messageBar: string[];
  messageBarText: string;
  visibleCells: Array<Array<VisibleCell | null>>;
};

function messageBarText(phrases: string[]): string {
  return phrases.join(" ");
}

export function isDestinationBoard(board: { kind?: "board" | "snippet" }): boolean {
  return board.kind !== "snippet";
}

export function homeBoard(boards: LiveBoard[]): LiveBoard | null {
  const destinations = boards.filter(isDestinationBoard);
  if (destinations.length === 0) return null;
  return [...destinations].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  })[0];
}

function newerButton(a: LiveButton, b: LiveButton): LiveButton {
  const byTime = a.created_at.localeCompare(b.created_at);
  if (byTime !== 0) return byTime > 0 ? a : b;
  return a.id >= b.id ? a : b;
}

function resolveHex(button: LiveButton, snapshot: LiveSnapshot): string {
  if (button.palette_color_id) {
    const color = snapshot.paletteColors.find((c) => c.id === button.palette_color_id);
    if (color) return color.hex;
  }
  if (button.background_color) return button.background_color;
  return "#ffffff";
}

function newerInclusion(a: LiveSnippetInclusion, b: LiveSnippetInclusion): LiveSnippetInclusion {
  const byTime = a.created_at.localeCompare(b.created_at);
  if (byTime !== 0) return byTime > 0 ? a : b;
  return a.id >= b.id ? a : b;
}

function ownButtonAt(grid: LiveBoard, row: number, col: number): LiveButton | null {
  const mapped = grid.buttons.filter(
    (button) => button.row_index === row && button.col_index === col,
  );
  if (mapped.length === 0) return null;
  return mapped.reduce(newerButton);
}

function contentAt(
  grid: LiveBoard,
  row: number,
  col: number,
  snapshot: LiveSnapshot,
  boardsById: Map<string, LiveBoard>,
  visiting: ReadonlySet<string>,
): LiveButton | null {
  if (row < 0 || col < 0 || row >= grid.height || col >= grid.width) return null;
  const own = ownButtonAt(grid, row, col);
  if (own) return own;
  if (visiting.has(grid.id)) return null;
  const nextVisiting = new Set(visiting);
  nextVisiting.add(grid.id);
  const inclusions = (snapshot.snippetInclusions ?? [])
    .filter((inc) => inc.host_id === grid.id)
    .sort((a, b) => (newerInclusion(a, b) === a ? -1 : 1));
  for (const inclusion of inclusions) {
    const snippet = boardsById.get(inclusion.snippet_id);
    if (!snippet) continue;
    const nested = contentAt(
      snippet,
      row - inclusion.origin_row,
      col - inclusion.origin_col,
      snapshot,
      boardsById,
      nextVisiting,
    );
    if (nested) return nested;
  }
  return null;
}

function visibleCells(board: LiveBoard | null, snapshot: LiveSnapshot | null) {
  if (!board || !snapshot) return [];
  const grid: Array<Array<VisibleCell | null>> = Array.from(
    { length: board.height },
    () => Array.from({ length: board.width }, () => null),
  );
  const boardsById = new Map(snapshot.boards.map((item) => [item.id, item]));
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const winner = contentAt(board, row, col, snapshot, boardsById, new Set());
      if (!winner) continue;
      grid[row][col] = {
        button: winner,
        backgroundHex: resolveHex(winner, snapshot),
      };
    }
  }
  return grid;
}

export function createCommunicatorSession(speech: SpeechAdapter) {
  let snapshot: LiveSnapshot | null = null;
  let currentBoard: LiveBoard | null = null;
  let phrases: string[] = [];
  let phase: CommunicatorPhase = "idle";

  function state(): CommunicatorState {
    return {
      phase,
      snapshot,
      currentBoard,
      messageBar: [...phrases],
      messageBarText: messageBarText(phrases),
      visibleCells: visibleCells(currentBoard, snapshot),
    };
  }

  let playing = false;

  function utter(text: string) {
    if (playing) speech.cancel();
    playing = true;
    speech.speak(text);
  }

  function perform(action: ButtonAction | null) {
    if (!action) return;
    if (action.kind === "insert_phrase") {
      phrases = [...phrases, action.phrase];
      return;
    }
    if (action.kind === "speak_immediately") {
      utter(action.phrase);
      return;
    }
    if (action.kind === "open_board") {
      const next = snapshot?.boards.find((board) => board.id === action.board_id);
      if (next && isDestinationBoard(next)) currentBoard = next;
      return;
    }
    if (action.kind === "clear_message_bar") {
      phrases = [];
      return;
    }
    if (action.kind === "backspace") {
      phrases = phrases.slice(0, -1);
      return;
    }
  }

  return {
    open(next: LiveSnapshot) {
      snapshot = next;
      phrases = [];
      const home = homeBoard(next.boards);
      if (!home) {
        currentBoard = null;
        phase = "empty-vocabulary";
        return state();
      }
      currentBoard = home;
      phase = "board";
      return state();
    },
    tap(rowIndex: number, colIndex: number) {
      if (phase !== "board" || !currentBoard) return state();
      const cell = visibleCells(currentBoard, snapshot)[rowIndex]?.[colIndex];
      if (cell) perform(cell.button.action);
      return state();
    },
    speak() {
      if (phrases.length === 0) return state();
      utter(messageBarText(phrases));
      return state();
    },
    home() {
      if (!snapshot) return state();
      const home = homeBoard(snapshot.boards);
      if (home) currentBoard = home;
      return state();
    },
    leave() {
      if (playing) speech.cancel();
      snapshot = null;
      currentBoard = null;
      phrases = [];
      playing = false;
      phase = "idle";
      return state();
    },
    getState: state,
  };
}
