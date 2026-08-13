import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  apiFetch,
  clearAuth,
  readAuth,
  writeAuth,
  type AuthState,
  type AuthUser,
} from "./api";
import {
  createCommunicatorSession,
  type LiveSnapshot,
} from "./communicatorSession";
import { deviceSpeech } from "./deviceSpeech";

type Screen = "boot" | "auth" | "list" | "vocab";
type AuthMode = "login" | "register";

type VocabularyListItem = {
  id: string;
  name: string;
  displayName: string;
};

function emailRedirectTo() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/?emailConfirmed=1`;
  }
  return "http://localhost:8081/?emailConfirmed=1";
}

export default function App() {
  const session = useMemo(() => createCommunicatorSession(deviceSpeech), []);
  const [screen, setScreen] = useState<Screen>("boot");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [vocabularies, setVocabularies] = useState<VocabularyListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [vocabError, setVocabError] = useState<string | null>(null);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [failedOpenId, setFailedOpenId] = useState<string | null>(null);
  const [, setRender] = useState(0);
  const bump = () => setRender((n) => n + 1);

  const token = auth?.session.access_token;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("emailConfirmed") === "1") {
          await clearAuth();
          if (!cancelled) {
            setAuthMode("login");
            setAuthMessage("Email confirmed. Please sign in.");
            setScreen("auth");
            window.history.replaceState({}, "", window.location.pathname);
          }
          return;
        }
      }
      const stored = await readAuth();
      if (cancelled) return;
      if (stored) {
        setAuth(stored);
        setScreen("list");
      } else {
        setScreen("auth");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadList = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await apiFetch<{ vocabularies: VocabularyListItem[] }>(
        "/vocabularies/using",
        { accessToken: token },
      );
      setVocabularies(data.vocabularies);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (screen === "list") {
      void loadList();
    }
  }, [screen, loadList]);

  async function submitAuth() {
    setAuthBusy(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const data = await apiFetch<{
        user?: AuthUser;
        session?: AuthState["session"];
        message?: string;
      }>(authMode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(
          authMode === "register"
            ? {
                name,
                email,
                password,
                emailRedirectTo: emailRedirectTo(),
              }
            : { email, password },
        ),
      });

      if (data.user && data.session) {
        const next = { user: data.user, session: data.session };
        await writeAuth(next);
        setAuth(next);
        setPassword("");
        setScreen("list");
        return;
      }

      if (data.message) setAuthMessage(data.message);
      setPassword("");
      if (authMode === "register") setName("");
    } catch (err) {
      await clearAuth();
      setAuthError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    session.leave();
    bump();
    await clearAuth();
    setAuth(null);
    setVocabularies([]);
    setScreen("auth");
  }

  async function openVocabulary(id: string) {
    if (!token) return;
    setFailedOpenId(id);
    setVocabLoading(true);
    setVocabError(null);
    try {
      const data = await apiFetch<{ snapshot: LiveSnapshot }>(
        `/vocabularies/${id}/live`,
        { accessToken: token },
      );
      session.open(data.snapshot);
      bump();
      setFailedOpenId(null);
      setScreen("vocab");
    } catch (err) {
      setVocabError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setVocabLoading(false);
    }
  }

  const state = session.getState();

  if (screen === "boot") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (screen === "auth") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>AAC</Text>
        <Text style={styles.subtitle}>
          {authMode === "login" ? "Sign in" : "Register"}
        </Text>
        {authMode === "register" ? (
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {authError ? <Text style={styles.error}>{authError}</Text> : null}
        {authMessage ? <Text style={styles.message}>{authMessage}</Text> : null}
        <Pressable
          style={styles.primaryButton}
          onPress={() => void submitAuth()}
          disabled={authBusy}
        >
          <Text style={styles.primaryButtonText}>
            {authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Register"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setAuthMode(authMode === "login" ? "register" : "login");
            setAuthError(null);
          }}
        >
          <Text style={styles.link}>
            {authMode === "login"
              ? "Need an account? Register"
              : "Have an account? Sign in"}
          </Text>
        </Pressable>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (screen === "list") {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Vocabularies</Text>
          <Pressable onPress={() => void signOut()}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
        {listLoading ? <ActivityIndicator /> : null}
        {listError ? (
          <View style={styles.banner}>
            <Text style={styles.error}>{listError}</Text>
            <Pressable onPress={() => void loadList()}>
              <Text style={styles.link}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {vocabError ? (
          <View style={styles.banner}>
            <Text style={styles.error}>{vocabError}</Text>
            {failedOpenId ? (
              <Pressable onPress={() => void openVocabulary(failedOpenId)}>
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!listLoading && !listError && vocabularies.length === 0 ? (
          <Text style={styles.empty}>No vocabularies shared with you yet.</Text>
        ) : null}
        <ScrollView>
          {vocabularies.map((vocabulary) => (
            <Pressable
              key={vocabulary.id}
              style={styles.listRow}
              onPress={() => void openVocabulary(vocabulary.id)}
              disabled={vocabLoading}
            >
              <Text style={styles.listRowText}>{vocabulary.displayName}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            session.home();
            bump();
          }}
        >
          <Text style={styles.link}>Home</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            session.leave();
            bump();
            setVocabError(null);
            setScreen("list");
          }}
        >
          <Text style={styles.link}>Leave</Text>
        </Pressable>
      </View>

      {state.phase === "empty-vocabulary" ? (
        <Text style={styles.empty}>This Vocabulary has no Boards.</Text>
      ) : (
        <>
          <View style={styles.messageBarRow}>
            <View style={styles.messageBar}>
              <Text style={styles.messageBarText}>
                {state.messageBarText || " "}
              </Text>
            </View>
            <Pressable
              style={styles.speakButton}
              onPress={() => {
                session.speak();
                bump();
              }}
            >
              <Text style={styles.primaryButtonText}>Speak</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {state.visibleCells.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((cell, colIndex) => (
                  <Pressable
                    key={`${rowIndex}-${colIndex}`}
                    style={[
                      styles.cell,
                      { backgroundColor: cell?.backgroundHex ?? "#f4f4f5" },
                    ]}
                    onPress={() => {
                      session.tap(rowIndex, colIndex);
                      bump();
                    }}
                  >
                    <Text style={styles.cellLabel}>{cell?.button.label ?? ""}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: 48,
    paddingHorizontal: 16,
    gap: 12,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
  },
  input: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 160,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  speakButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
  },
  link: {
    color: "#2563eb",
    fontWeight: "600",
  },
  error: {
    color: "#b00020",
  },
  message: {
    color: "#166534",
  },
  empty: {
    color: "#64748b",
    fontSize: 16,
    marginTop: 24,
  },
  listRow: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  listRowText: {
    fontSize: 18,
  },
  banner: {
    gap: 8,
  },
  messageBarRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  messageBar: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  messageBarText: {
    fontSize: 18,
  },
  grid: {
    flex: 1,
    gap: 6,
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  cell: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  cellLabel: {
    fontSize: 16,
    textAlign: "center",
  },
});
