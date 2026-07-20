import { StyleSheet, Text, View } from "react-native";
import { SQLiteDatabase, SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

export default function Index() {
  return (
    <SQLiteProvider databaseName="testDatabase" onInit={setupDatabase}>
      <View style={styles.container}>
        <Text>Edit src/app/index.tsx to edit this screen.</Text>
        <Test />
      </View>
    </SQLiteProvider>
  );
}

export function Test() {
  const db = useSQLiteContext();

  const [sqliteVersion, setSqliteVersion] = useState("");
  useEffect(() => {
    async function setup() {
      const result = await db.getFirstAsync<{ "sqlite_version()": string }>(
        "SELECT sqlite_version()",
      );
      setSqliteVersion(result!["sqlite_version()"]);
    }
    setup();
  }, []);

  interface Board {
    id: number;
    rows: number;
    columns: number;
  }

  interface Icon {
    id: number;
    label: string;
  }

  interface BoardWithIcons extends Board {
    icons: Icon[];
  }

  const [boards, setBoards] = useState<BoardWithIcons[]>([]);
  useEffect(() => {
    async function setup() {
      const rows = await db.getAllAsync<Board>(
        "SELECT * FROM boards ORDER BY id",
      );
      const boardsWithIcons: BoardWithIcons[] = [];
      for (const row of rows) {
        const icons = await db.getAllAsync<Icon>(
          "SELECT * FROM icons WHERE board_id = ?",
          [row.id],
        );
        boardsWithIcons.push({ ...row, icons });
      }
      setBoards(boardsWithIcons);
    }
    setup();
  }, []);

  function addBoard() {
    db.runAsync(
      "INSERT INTO boards (rows, columns) VALUES (?, ?)",
      [4, 5],
    ).then(() => {
      db.getAllAsync<Board>("SELECT * FROM boards ORDER BY id").then((rows) => {
        const boardsWithIcons: BoardWithIcons[] = [];
        for (const row of rows) {
          db.getAllAsync<Icon>("SELECT * FROM icons WHERE board_id = ?", [
            row.id,
          ]).then((icons) => {
            boardsWithIcons.push({ ...row, icons });
            if (boardsWithIcons.length === rows.length) {
              setBoards(boardsWithIcons);
            }
          });
        }
      });
    });
  }

  function addIcon(boardId: number) {
    db.runAsync("INSERT INTO icons (board_id, label) VALUES (?, ?)", [
      boardId,
      `Icon ${Math.floor(Math.random() * 100)}`,
    ]).then(() => {
      db.getAllAsync<Icon>("SELECT * FROM icons WHERE board_id = ?", [
        boardId,
      ]).then((icons) => {
        setBoards((prevBoards) =>
          prevBoards.map((board) =>
            board.id === boardId ? { ...board, icons } : board,
          ),
        );
      });
    });
  }

  return (
    <View>
      <Text>SQLite version: {sqliteVersion}</Text>
      {boards.map((board) => (
        <Text key={board.id}>
          {board.id}: {board.rows}x{board.columns} ({board.icons.length} icons){" "}
          <Text onPress={() => addIcon(board.id)}>Add Icon</Text>
        </Text>
      ))}
      <Text onPress={addBoard}>Add Board</Text>
    </View>
  );
}

async function setupDatabase(db: SQLiteDatabase) {
  // Fully reset the database for testing purposes. In a real app, you would not do this.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    DROP TABLE IF EXISTS boards;
    CREATE TABLE boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rows INTEGER NOT NULL,
      columns INTEGER NOT NULL
    );

    DROP TABLE IF EXISTS icons;
    CREATE TABLE icons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES boards(id),
      label TEXT NOT NULL
    );
  `);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
