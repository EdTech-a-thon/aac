import { describe, expect, it } from "vitest";
import {
  createCommunicatorSession,
  type LiveSnapshot,
  type SpeechAdapter,
} from "./communicatorSession.ts";

function speechSpy(): SpeechAdapter & { spoken: string[]; cancelled: number } {
  const spoken: string[] = [];
  let cancelled = 0;
  return {
    spoken,
    get cancelled() {
      return cancelled;
    },
    speak(text: string) {
      spoken.push(text);
    },
    cancel() {
      cancelled += 1;
    },
  };
}

function snapshot(overrides: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return {
    id: "vocab-1",
    name: "Food",
    displayName: "Food",
    revision: 1,
    paletteColors: [
      {
        id: "pal-noun",
        vocabulary_id: "vocab-1",
        hex: "#ffb74d",
        name: "Nouns",
        description: "",
        position: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    boards: [],
    ...overrides,
  };
}

function board(partial: {
  id: string;
  name?: string;
  width?: number;
  height?: number;
  created_at?: string;
  buttons?: LiveSnapshot["boards"][0]["buttons"];
}): LiveSnapshot["boards"][0] {
  return {
    id: partial.id,
    vocabulary_id: "vocab-1",
    name: partial.name ?? "",
    displayName: partial.name?.trim() ? partial.name : "Untitled",
    width: partial.width ?? 2,
    height: partial.height ?? 2,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    buttons: partial.buttons ?? [],
  };
}

function button(partial: {
  id: string;
  board_id: string;
  row_index: number;
  col_index: number;
  label?: string;
  created_at?: string;
  palette_color_id?: string | null;
  background_color?: string | null;
  action?: LiveSnapshot["boards"][0]["buttons"][0]["action"];
}): LiveSnapshot["boards"][0]["buttons"][0] {
  return {
    id: partial.id,
    board_id: partial.board_id,
    row_index: partial.row_index,
    col_index: partial.col_index,
    label: partial.label ?? "",
    background_color: partial.background_color ?? null,
    palette_color_id: partial.palette_color_id ?? null,
    action: partial.action ?? null,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: partial.created_at ?? "2026-01-01T00:00:00Z",
  };
}

describe("Communicator session", () => {
  it("opens the Home Board (earliest created, then lower id)", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "b-later", created_at: "2026-01-02T00:00:00Z", name: "Later" }),
          board({
            id: "b-home-z",
            created_at: "2026-01-01T00:00:00Z",
            name: "Z",
          }),
          board({
            id: "b-home-a",
            created_at: "2026-01-01T00:00:00Z",
            name: "A",
          }),
        ],
      }),
    );
    expect(session.getState().phase).toBe("board");
    expect(session.getState().currentBoard?.id).toBe("b-home-a");
  });

  it("opens an empty Vocabulary with no Home Board", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(snapshot({ boards: [] }));
    expect(session.getState().phase).toBe("empty-vocabulary");
    expect(session.getState().currentBoard).toBeNull();
  });

  it("appends Insert Phrase and joins the Message Bar with a single space", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "i",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
              button({
                id: "want",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                action: { kind: "insert_phrase", phrase: "want" },
              }),
            ],
          }),
        ],
      }),
    );
    session.tap(0, 0);
    session.tap(0, 1);
    expect(session.getState().messageBar).toEqual(["I", "want"]);
    expect(session.getState().messageBarText).toBe("I want");
  });

  it("Backspace removes the last phrase; Clear empties the Message Bar", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            width: 3,
            height: 1,
            buttons: [
              button({
                id: "a",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
              button({
                id: "b",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                action: { kind: "backspace" },
              }),
              button({
                id: "c",
                board_id: "home",
                row_index: 0,
                col_index: 2,
                action: { kind: "clear_message_bar" },
              }),
            ],
          }),
        ],
      }),
    );
    session.tap(0, 0);
    session.tap(0, 0);
    session.tap(0, 1);
    expect(session.getState().messageBar).toEqual(["I"]);
    session.tap(0, 0);
    session.tap(0, 2);
    expect(session.getState().messageBar).toEqual([]);
  });

  it("Speak Immediately speaks without changing the Message Bar", () => {
    const speech = speechSpy();
    const session = createCommunicatorSession(speech);
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "hi",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "speak_immediately", phrase: "hello" },
              }),
              button({
                id: "ins",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
            ],
          }),
        ],
      }),
    );
    session.tap(0, 1);
    session.tap(0, 0);
    expect(session.getState().messageBar).toEqual(["I"]);
    expect(speech.spoken).toEqual(["hello"]);
  });

  it("Open Board jumps and keeps the Message Bar", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            created_at: "2026-01-01T00:00:00Z",
            buttons: [
              button({
                id: "ins",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
              button({
                id: "go",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                action: { kind: "open_board", board_id: "food" },
              }),
            ],
          }),
          board({ id: "food", created_at: "2026-01-02T00:00:00Z", name: "Food" }),
        ],
      }),
    );
    session.tap(0, 0);
    session.tap(0, 1);
    expect(session.getState().currentBoard?.id).toBe("food");
    expect(session.getState().messageBar).toEqual(["I"]);
  });

  it("Play YouTube Clip and missing Action are no-ops", () => {
    const speech = speechSpy();
    const session = createCommunicatorSession(speech);
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "yt",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: {
                  kind: "play_youtube_clip",
                  video_id: "abcdefghijk",
                  start: 0,
                  end: 1,
                },
              }),
              button({
                id: "none",
                board_id: "home",
                row_index: 0,
                col_index: 1,
              }),
            ],
          }),
        ],
      }),
    );
    session.tap(0, 0);
    session.tap(0, 1);
    session.tap(1, 1);
    expect(session.getState().messageBar).toEqual([]);
    expect(speech.spoken).toEqual([]);
  });

  it("uses the most recently created overlapping Button", () => {
    const speech = speechSpy();
    const session = createCommunicatorSession(speech);
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "old",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                created_at: "2026-01-01T00:00:00Z",
                action: { kind: "speak_immediately", phrase: "old" },
              }),
              button({
                id: "new",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                created_at: "2026-01-02T00:00:00Z",
                action: { kind: "speak_immediately", phrase: "new" },
              }),
            ],
          }),
        ],
      }),
    );
    session.tap(0, 0);
    expect(speech.spoken).toEqual(["new"]);
  });

  it("Speak is a no-op when the Message Bar is empty and interrupts current speech", () => {
    const speech = speechSpy();
    const session = createCommunicatorSession(speech);
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "ins",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
              button({
                id: "now",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                action: { kind: "speak_immediately", phrase: "now" },
              }),
            ],
          }),
        ],
      }),
    );
    session.speak();
    expect(speech.spoken).toEqual([]);
    expect(speech.cancelled).toBe(0);
    session.tap(0, 0);
    session.speak();
    expect(speech.spoken).toEqual(["I"]);
    session.tap(0, 1);
    expect(speech.cancelled).toBe(1);
    expect(speech.spoken).toEqual(["I", "now"]);
  });

  it("Home opens the Home Board or no-ops; leave discards the Message Bar", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            created_at: "2026-01-01T00:00:00Z",
            buttons: [
              button({
                id: "ins",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
              button({
                id: "go",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                action: { kind: "open_board", board_id: "food" },
              }),
            ],
          }),
          board({ id: "food", created_at: "2026-01-02T00:00:00Z" }),
        ],
      }),
    );
    session.home();
    expect(session.getState().currentBoard?.id).toBe("home");
    session.tap(0, 0);
    session.tap(0, 1);
    session.home();
    expect(session.getState().currentBoard?.id).toBe("home");
    expect(session.getState().messageBar).toEqual(["I"]);
    session.leave();
    expect(session.getState().phase).toBe("idle");
    expect(session.getState().messageBar).toEqual([]);
    expect(session.getState().currentBoard).toBeNull();
  });

  it("leave stops in-flight speech", () => {
    const speech = speechSpy();
    const session = createCommunicatorSession(speech);
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "now",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "speak_immediately", phrase: "hello" },
              }),
            ],
          }),
        ],
      }),
    );
    session.tap(0, 0);
    session.leave();
    expect(speech.cancelled).toBe(1);
  });

  it("resolves unset to white and Palette bindings to hex", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "unset",
                board_id: "home",
                row_index: 0,
                col_index: 0,
              }),
              button({
                id: "bound",
                board_id: "home",
                row_index: 0,
                col_index: 1,
                palette_color_id: "pal-noun",
              }),
              button({
                id: "custom",
                board_id: "home",
                row_index: 1,
                col_index: 0,
                background_color: "#123456",
              }),
            ],
          }),
        ],
      }),
    );
    const cells = session.getState().visibleCells;
    expect(cells[0]?.[0]?.backgroundHex).toBe("#ffffff");
    expect(cells[0]?.[1]?.backgroundHex).toBe("#ffb74d");
    expect(cells[1]?.[0]?.backgroundHex).toBe("#123456");
  });
});
