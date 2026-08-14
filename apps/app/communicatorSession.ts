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

function visibleCells(board: LiveBoard | null, snapshot: LiveSnapshot | null) {
  if (!board || !snapshot) return [];
  const grid: Array<Array<VisibleCell | null>> = Array.from(
    { length: board.height },
    () => Array.from({ length: board.width }, () => null),
  );
  for (const button of board.buttons) {
    if (
      button.row_index < 0 ||
      button.col_index < 0 ||
      button.row_index >= board.height ||
      button.col_index >= board.width
    ) {
      continue;
    }
    const existing = grid[button.row_index][button.col_index];
    const winner = existing ? newerButton(existing.button, button) : button;
    grid[button.row_index][button.col_index] = {
      button: winner,
      backgroundHex: resolveHex(winner, snapshot),
    };
  }

  const hostInclusions = (snapshot.snippetInclusions ?? [])
    .filter((inc) => inc.host_id === board.id)
    .sort((a, b) => {
      const newer = newerInclusion(a, b);
      return newer === a ? -1 : 1;
    });
  const boardsById = new Map(snapshot.boards.map((b) => [b.id, b]));

  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (grid[row][col]) continue;
      for (const inclusion of hostInclusions) {
        const snippet = boardsById.get(inclusion.snippet_id);
        if (!snippet) continue;
        const localRow = row - inclusion.origin_row;
        const localCol = col - inclusion.origin_col;
        if (
          localRow < 0 ||
          localCol < 0 ||
          localRow >= snippet.height ||
          localCol >= snippet.width
        ) {
          continue;
        }
        const mapped = snippet.buttons.filter(
          (button) => button.row_index === localRow && button.col_index === localCol,
        );
        if (mapped.length === 0) continue;
        const winner = mapped.reduce(newerButton);
        grid[row][col] = {
          button: winner,
          backgroundHex: resolveHex(winner, snapshot),
        };
        break;
      }
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
