<script lang="ts">
	import { apiFetch, type AuthState } from '$lib/auth';
	import { normalizeSuggestedChangeSets } from '$lib/describeChangeSetMutations';
	import {
		getVocabularyEditorSession,
		persistEditorSession,
		subscribeEditorRevision,
		type SuggestedChangeSet
	} from '$lib/vocabularyEditorSession';

	let {
		vocabularyId,
		auth
	}: {
		vocabularyId: string;
		auth: AuthState;
	} = $props();

	let revision = $state(0);

	$effect(() => subscribeEditorRevision(() => {
		revision += 1;
	}));

	const session = $derived(getVocabularyEditorSession(vocabularyId));
	const suggestionCount = $derived.by(() => {
		revision;
		return session.suggestedChangeSets.length;
	});

	$effect(() => {
		const id = vocabularyId;
		const token = auth.session.access_token;
		if (!id || !token) return;
		let cancelled = false;
		(async () => {
			try {
				const data = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
					`/vocabularies/${id}/change-sets?status=suggested`,
					{ accessToken: token }
				);
				if (!cancelled) {
					persistEditorSession(getVocabularyEditorSession(id), {
						suggestedChangeSets: normalizeSuggestedChangeSets(data.changeSets)
					});
				}
			} catch {
				// Keep whatever is already cached; BoardWorkspace may refill.
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	function suggestionLabel(count: number) {
		return count === 1 ? 'pending suggestion' : 'pending suggestions';
	}
</script>

{#if suggestionCount > 0}
	<a
		href={`/vocabularies/${vocabularyId}/suggestions`}
		class="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-900"
	>
		View {suggestionCount}
		{suggestionLabel(suggestionCount)}
	</a>
{/if}
