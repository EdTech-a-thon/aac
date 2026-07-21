import { getContext, setContext } from 'svelte';
import type { AuthState } from '$lib/auth';
import type { Vocabulary } from '$lib/types';

export type DashboardState = {
	auth: AuthState | null;
	vocabularies: Vocabulary[];
	loading: boolean;
	error: string | null;
	reload: () => Promise<void>;
	addVocabulary: (vocabulary: Vocabulary) => void;
	replaceVocabulary: (vocabulary: Vocabulary) => void;
	removeVocabulary: (id: string) => void;
};

const KEY = 'aac-dashboard';

export function setDashboard(state: DashboardState) {
	setContext(KEY, state);
}

export function getDashboard(): DashboardState {
	return getContext(KEY);
}
