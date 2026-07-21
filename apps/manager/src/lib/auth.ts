import { PUBLIC_API_URL } from '$env/static/public';

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

export const AUTH_STORAGE_KEY = 'manager-auth';

export function readAuth(): AuthState | null {
	if (typeof localStorage === 'undefined') return null;
	const stored = localStorage.getItem(AUTH_STORAGE_KEY);
	if (!stored) return null;

	try {
		const parsed = JSON.parse(stored) as Partial<AuthState>;
		if (!parsed.user?.id || !parsed.session?.access_token) {
			localStorage.removeItem(AUTH_STORAGE_KEY);
			return null;
		}
		return parsed as AuthState;
	} catch {
		localStorage.removeItem(AUTH_STORAGE_KEY);
		return null;
	}
}

export function writeAuth(state: AuthState) {
	localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearAuth() {
	localStorage.removeItem(AUTH_STORAGE_KEY);
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
	options: RequestInit & { accessToken?: string } = {}
): Promise<T> {
	const { accessToken, headers, ...rest } = options;
	const response = await fetch(`${PUBLIC_API_URL}${path}`, {
		...rest,
		headers: {
			'Content-Type': 'application/json',
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			...headers
		}
	});

	const data = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new ApiError(
			typeof data.error === 'string' ? data.error : 'Something went wrong',
			response.status
		);
	}

	return data as T;
}
