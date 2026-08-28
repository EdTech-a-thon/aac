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
    snippetInclusions: [],
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
  symbol_digest?: string | null;
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
    symbol_digest: partial.symbol_digest ?? null,
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

  it("ignores Snippets when choosing Home Board, even if a Snippet was created first", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          {
            ...board({ id: "snip", created_at: "2026-01-01T00:00:00Z", name: "Strip" }),
            kind: "snippet",
          },
          board({ id: "home", created_at: "2026-01-02T00:00:00Z", name: "Home" }),
        ],
      }),
    );
    expect(session.getState().phase).toBe("board");
    expect(session.getState().currentBoard?.id).toBe("home");
  });

  it("opens an empty Vocabulary when only Snippets exist", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          {
            ...board({ id: "snip", name: "Strip" }),
            kind: "snippet",
          },
        ],
      }),
    );
    expect(session.getState().phase).toBe("empty-vocabulary");
    expect(session.getState().currentBoard).toBeNull();
  });

  it("opens an empty Vocabulary with no Home Board", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(snapshot({ boards: [] }));
    expect(session.getState().phase).toBe("empty-vocabulary");
    expect(session.getState().currentBoard).toBeNull();
  });

  it("draws Snippet Inclusion Buttons on the host Board", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 4, height: 2 }),
          {
            ...board({
              id: "snip",
              name: "Strip",
              width: 2,
              height: 1,
              buttons: [
                button({
                  id: "go",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 0,
                  label: "Go",
                  action: { kind: "insert_phrase", phrase: "go" },
                }),
                button({
                  id: "home-btn",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 1,
                  label: "Home",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-1",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const cells = session.getState().visibleCells;
    expect(cells[0]?.[1]?.button.id).toBe("go");
    expect(cells[0]?.[2]?.button.id).toBe("home-btn");
    expect(cells[0]?.[0]).toBeNull();
  });

  it("lets a host Button cover inclusion content, even if the host Button is older", () => {
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
                id: "cover",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                label: "Cover",
                created_at: "2026-01-01T00:00:00Z",
              }),
            ],
          }),
          {
            ...board({
              id: "snip",
              width: 2,
              height: 1,
              buttons: [
                button({
                  id: "under",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 0,
                  label: "Under",
                  created_at: "2026-01-02T00:00:00Z",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-1",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-03T00:00:00Z",
            updated_at: "2026-01-03T00:00:00Z",
          },
        ],
      }),
    );
    expect(session.getState().visibleCells[0]?.[0]?.button.id).toBe("cover");
  });

  it("lets the newest inclusion's Button win when two inclusions map a Button to the same cell", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 3, height: 3 }),
          {
            ...board({
              id: "top",
              width: 3,
              height: 1,
              buttons: [
                button({
                  id: "top-corner",
                  board_id: "top",
                  row_index: 0,
                  col_index: 2,
                  label: "Top",
                }),
              ],
            }),
            kind: "snippet",
          },
          {
            ...board({
              id: "side",
              width: 1,
              height: 3,
              buttons: [
                button({
                  id: "side-corner",
                  board_id: "side",
                  row_index: 0,
                  col_index: 0,
                  label: "Side",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-top",
            host_id: "home",
            snippet_id: "top",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "inc-side",
            host_id: "home",
            snippet_id: "side",
            origin_row: 0,
            origin_col: 2,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    expect(session.getState().visibleCells[0]?.[2]?.button.id).toBe("side-corner");
  });

  it("punches through empty cells in a newer inclusion to an older inclusion's Button", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 3, height: 3 }),
          {
            ...board({
              id: "top",
              width: 3,
              height: 1,
              buttons: [
                button({
                  id: "top-left",
                  board_id: "top",
                  row_index: 0,
                  col_index: 0,
                  label: "A",
                }),
              ],
            }),
            kind: "snippet",
          },
          {
            ...board({
              id: "side",
              width: 1,
              height: 3,
              buttons: [
                button({
                  id: "side-corner",
                  board_id: "side",
                  row_index: 0,
                  col_index: 0,
                  label: "C",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-side",
            host_id: "home",
            snippet_id: "side",
            origin_row: 0,
            origin_col: 2,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "inc-top",
            host_id: "home",
            snippet_id: "top",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    const cells = session.getState().visibleCells;
    expect(cells[0]?.[0]?.button.id).toBe("top-left");
    expect(cells[0]?.[2]?.button.id).toBe("side-corner");
  });

  it("draws the same Snippet twice on one host as separate inclusions", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 4, height: 1 }),
          {
            ...board({
              id: "snip",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "hi",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 0,
                  label: "Hi",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-a",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "inc-b",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 2,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    const cells = session.getState().visibleCells;
    expect(cells[0]?.[0]?.button.id).toBe("hi");
    expect(cells[0]?.[2]?.button.id).toBe("hi");
    expect(cells[0]?.[1]).toBeNull();
  });

  it("lets a host Button cover overlapping inclusion content", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            width: 3,
            height: 3,
            buttons: [
              button({
                id: "cover",
                board_id: "home",
                row_index: 0,
                col_index: 2,
                label: "Cover",
                created_at: "2026-01-01T00:00:00Z",
              }),
            ],
          }),
          {
            ...board({
              id: "top",
              width: 3,
              height: 1,
              buttons: [
                button({
                  id: "top-corner",
                  board_id: "top",
                  row_index: 0,
                  col_index: 2,
                  label: "Top",
                  created_at: "2026-01-04T00:00:00Z",
                }),
              ],
            }),
            kind: "snippet",
          },
          {
            ...board({
              id: "side",
              width: 1,
              height: 3,
              buttons: [
                button({
                  id: "side-corner",
                  board_id: "side",
                  row_index: 0,
                  col_index: 0,
                  label: "Side",
                  created_at: "2026-01-04T00:00:00Z",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-top",
            host_id: "home",
            snippet_id: "top",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
          {
            id: "inc-side",
            host_id: "home",
            snippet_id: "side",
            origin_row: 0,
            origin_col: 2,
            created_at: "2026-01-03T00:00:00Z",
            updated_at: "2026-01-03T00:00:00Z",
          },
        ],
      }),
    );
    expect(session.getState().visibleCells[0]?.[2]?.button.id).toBe("cover");
  });

  it("breaks a newest-inclusion tie with the higher identifier", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 1, height: 1 }),
          {
            ...board({
              id: "older-id",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "from-a",
                  board_id: "older-id",
                  row_index: 0,
                  col_index: 0,
                  label: "A",
                }),
              ],
            }),
            kind: "snippet",
          },
          {
            ...board({
              id: "newer-id",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "from-b",
                  board_id: "newer-id",
                  row_index: 0,
                  col_index: 0,
                  label: "B",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-a",
            host_id: "home",
            snippet_id: "older-id",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "inc-b",
            host_id: "home",
            snippet_id: "newer-id",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    expect(session.getState().visibleCells[0]?.[0]?.button.id).toBe("from-b");
  });

  it("grows inclusion occupancy when the Snippet is resized; origins stay put", () => {
    const session = createCommunicatorSession(speechSpy());
    const snipButtons = [
      button({
        id: "row0",
        board_id: "snip",
        row_index: 0,
        col_index: 0,
        label: "Row0",
      }),
      button({
        id: "row1",
        board_id: "snip",
        row_index: 1,
        col_index: 0,
        label: "Row1",
      }),
    ];
    const inclusion = {
      id: "inc-1",
      host_id: "home",
      snippet_id: "snip",
      origin_row: 0,
      origin_col: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 4, height: 3 }),
          {
            ...board({
              id: "snip",
              width: 2,
              height: 1,
              buttons: snipButtons,
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [inclusion],
      }),
    );
    expect(session.getState().visibleCells[0]?.[1]?.button.id).toBe("row0");
    expect(session.getState().visibleCells[1]?.[1]).toBeNull();

    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 4, height: 3 }),
          {
            ...board({
              id: "snip",
              width: 2,
              height: 2,
              buttons: snipButtons,
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [inclusion],
      }),
    );
    expect(session.getState().visibleCells[0]?.[1]?.button.id).toBe("row0");
    expect(session.getState().visibleCells[1]?.[1]?.button.id).toBe("row1");

    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 4, height: 3 }),
          {
            ...board({
              id: "snip",
              width: 2,
              height: 1,
              buttons: snipButtons,
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [inclusion],
      }),
    );
    expect(session.getState().visibleCells[0]?.[1]?.button.id).toBe("row0");
    expect(session.getState().visibleCells[1]?.[1]).toBeNull();
  });

  it("hides inclusion cells that sit outside the host viewport", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 2, height: 1 }),
          {
            ...board({
              id: "snip",
              width: 3,
              height: 1,
              buttons: [
                button({
                  id: "in",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 0,
                  label: "In",
                }),
                button({
                  id: "out",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 2,
                  label: "Out",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-1",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const cells = session.getState().visibleCells;
    expect(cells[0]?.[1]?.button.id).toBe("in");
    expect(cells[0]?.length).toBe(2);
    session.tap(0, 2);
    expect(session.getState().messageBar).toEqual([]);
  });

  it("tapping a flattened Snippet Button performs that Button's Action", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 3, height: 1 }),
          {
            ...board({
              id: "snip",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "go",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 0,
                  action: { kind: "insert_phrase", phrase: "go" },
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-1",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    session.tap(0, 0);
    expect(session.getState().messageBar).toEqual(["go"]);
  });

  it("tapping a flattened Open Board Snippet Button jumps and keeps the Message Bar", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            created_at: "2026-01-01T00:00:00Z",
            width: 2,
            height: 1,
            buttons: [
              button({
                id: "ins",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "insert_phrase", phrase: "I" },
              }),
            ],
          }),
          board({ id: "food", created_at: "2026-01-02T00:00:00Z", name: "Food" }),
          {
            ...board({
              id: "snip",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "go",
                  board_id: "snip",
                  row_index: 0,
                  col_index: 0,
                  action: { kind: "open_board", board_id: "food" },
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-1",
            host_id: "home",
            snippet_id: "snip",
            origin_row: 0,
            origin_col: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    session.tap(0, 0);
    session.tap(0, 1);
    expect(session.getState().currentBoard?.id).toBe("food");
    expect(session.getState().messageBar).toEqual(["I"]);
  });

  it("flattens nested Snippet Inclusions onto the host Board", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 4, height: 1 }),
          {
            ...board({
              id: "outer",
              width: 2,
              height: 1,
              buttons: [
                button({
                  id: "outer-btn",
                  board_id: "outer",
                  row_index: 0,
                  col_index: 0,
                  label: "Out",
                }),
              ],
            }),
            kind: "snippet",
          },
          {
            ...board({
              id: "inner",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "inner-btn",
                  board_id: "inner",
                  row_index: 0,
                  col_index: 0,
                  label: "In",
                  action: { kind: "insert_phrase", phrase: "in" },
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-home-outer",
            host_id: "home",
            snippet_id: "outer",
            origin_row: 0,
            origin_col: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "inc-outer-inner",
            host_id: "outer",
            snippet_id: "inner",
            origin_row: 0,
            origin_col: 1,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    const cells = session.getState().visibleCells;
    expect(cells[0]?.[1]?.button.id).toBe("outer-btn");
    expect(cells[0]?.[2]?.button.id).toBe("inner-btn");
    session.tap(0, 2);
    expect(session.getState().messageBar).toEqual(["in"]);
  });

  it("lets a Snippet's own Button cover nested inclusion content", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "home", width: 2, height: 1 }),
          {
            ...board({
              id: "outer",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "cover",
                  board_id: "outer",
                  row_index: 0,
                  col_index: 0,
                  label: "Cover",
                  created_at: "2026-01-01T00:00:00Z",
                }),
              ],
            }),
            kind: "snippet",
          },
          {
            ...board({
              id: "inner",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "under",
                  board_id: "inner",
                  row_index: 0,
                  col_index: 0,
                  label: "Under",
                  created_at: "2026-01-03T00:00:00Z",
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-home-outer",
            host_id: "home",
            snippet_id: "outer",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "inc-outer-inner",
            host_id: "outer",
            snippet_id: "inner",
            origin_row: 0,
            origin_col: 0,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    expect(session.getState().visibleCells[0]?.[0]?.button.id).toBe("cover");
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

  it("Open Board to a Snippet does not change the current Board", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "home",
            buttons: [
              button({
                id: "go",
                board_id: "home",
                row_index: 0,
                col_index: 0,
                action: { kind: "open_board", board_id: "snip" },
              }),
            ],
          }),
          {
            ...board({ id: "snip", name: "Strip" }),
            kind: "snippet",
          },
        ],
      }),
    );
    session.tap(0, 0);
    expect(session.getState().currentBoard?.id).toBe("home");
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

describe("Communicator session Symbols", () => {
  const DIGEST = "e".repeat(64);

  it("exposes a Button's Symbol on its visible cell", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "b-home",
            buttons: [
              button({
                id: "btn-1",
                board_id: "b-home",
                row_index: 0,
                col_index: 0,
                label: "drink",
                symbol_digest: DIGEST,
              }),
            ],
          }),
        ],
      }),
    );
    expect(session.getState().visibleCells[0][0]?.button.symbol_digest).toBe(DIGEST);
  });

  it("leaves a Button without a Symbol as null", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({
            id: "b-home",
            buttons: [
              button({ id: "btn-1", board_id: "b-home", row_index: 0, col_index: 0 }),
            ],
          }),
        ],
      }),
    );
    expect(session.getState().visibleCells[0][0]?.button.symbol_digest).toBeNull();
  });

  it("carries a Symbol through a Snippet Inclusion", () => {
    const session = createCommunicatorSession(speechSpy());
    session.open(
      snapshot({
        boards: [
          board({ id: "b-home", width: 2, height: 2, buttons: [] }),
          {
            ...board({
              id: "snip-1",
              width: 1,
              height: 1,
              buttons: [
                button({
                  id: "btn-snip",
                  board_id: "snip-1",
                  row_index: 0,
                  col_index: 0,
                  label: "yes",
                  symbol_digest: DIGEST,
                }),
              ],
            }),
            kind: "snippet",
          },
        ],
        snippetInclusions: [
          {
            id: "inc-1",
            host_id: "b-home",
            snippet_id: "snip-1",
            origin_row: 1,
            origin_col: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    expect(session.getState().visibleCells[1][1]?.button.symbol_digest).toBe(DIGEST);
  });
});
