const AUTH_STORAGE_KEY = "aac-auth";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export type AuthState = {
  user: AuthUser;
  session: AuthSession;
};

function webStorage() {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export async function readAuth(): Promise<AuthState | null> {
  try {
    const { Platform } = await import("react-native");
    let raw: string | null = null;
    if (Platform.OS === "web") {
      raw = webStorage()?.getItem(AUTH_STORAGE_KEY) ?? null;
    } else {
      const SecureStore = await import("expo-secure-store");
      raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.user?.id || !parsed.session?.access_token) {
      await clearAuth();
      return null;
    }
    return parsed as AuthState;
  } catch {
    return null;
  }
}

export async function writeAuth(state: AuthState) {
  const raw = JSON.stringify(state);
  const { Platform } = await import("react-native");
  if (Platform.OS === "web") {
    webStorage()?.setItem(AUTH_STORAGE_KEY, raw);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, raw);
}

export async function clearAuth() {
  const { Platform } = await import("react-native");
  if (Platform.OS === "web") {
    webStorage()?.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new ApiError("EXPO_PUBLIC_API_URL is not set", 0);
  }

  const { accessToken, headers, ...rest } = options;
  const response = await fetch(`${apiUrl}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : "Something went wrong",
      response.status,
    );
  }

  return data as T;
}

/**
 * A Symbol's bytes, addressed by digest. The API redirects to the public
 * object; the digest is the read capability, and bytes behind it never change,
 * so the result is safe to cache indefinitely.
 */
export function symbolUrl(digest: string): string | null {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return null;
  return `${apiUrl}/symbols/${digest}`;
}
