<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getDashboard } from '$lib/dashboard';
	import { ApiError, apiFetch, clearAuth } from '$lib/auth';
	import { normalizeSuggestedChangeSets } from '$lib/describeChangeSetMutations';
	import {
		getVocabularyEditorSession,
		persistEditorSession,
		type SuggestedChangeSet
	} from '$lib/vocabularyEditorSession';

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');

	let loading = $state(true);
	let error = $state<string | null>(null);
	let suggestions = $state<SuggestedChangeSet[]>([]);

	function authorLabel(suggestion: SuggestedChangeSet) {
		const name = suggestion.author_name?.trim();
		if (name) return name;
		const email = suggestion.author_email?.trim();
		if (email) return email;
		return 'Unknown author';
	}

	function createdLabel(iso: string) {
		try {
			return new Date(iso).toLocaleString();
		} catch {
			return iso;
		}
	}

	function changeCountLabel(count: number) {
		return count === 1 ? '1 change' : `${count} changes`;
	}

	$effect(() => {
		const id = vocabularyId;
		const auth = dashboard.auth;
		if (!id || !auth) return;

		let cancelled = false;
		(async () => {
			loading = true;
			error = null;
			try {
				const data = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
					`/vocabularies/${id}/change-sets?status=suggested`,
					{ accessToken: auth.session.access_token }
				);
				if (cancelled) return;
				const normalized = normalizeSuggestedChangeSets(data.changeSets);
				suggestions = normalized;
				persistEditorSession(getVocabularyEditorSession(id), {
					suggestedChangeSets: normalized
				});
			} catch (err) {
				if (cancelled) return;
				if (err instanceof ApiError && err.status === 401) {
					clearAuth();
					await goto('/');
					return;
				}
				error = err instanceof Error ? err.message : 'Failed to load suggestions';
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-auto">
	<header
		class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
	>
		<div>
			<a
				href={`/vocabularies/${vocabularyId}`}
				class="text-sm font-medium text-emerald-700 hover:underline"
			>
				← Back to boards
			</a>
			<h1 class="mt-1 text-xl font-semibold text-slate-900">Suggestions</h1>
		</div>
	</header>

	<div class="flex-1 p-6">
		{#if loading}
			<p class="text-sm text-slate-500">Loading suggestions…</p>
		{:else if error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{:else if suggestions.length === 0}
			<p class="text-sm text-slate-500">No pending suggestions.</p>
		{:else}
			<ul class="space-y-3">
				{#each suggestions as suggestion (suggestion.id)}
					<li>
						<a
							href={`/vocabularies/${vocabularyId}/suggestions/${suggestion.id}`}
							class="block rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50/40"
						>
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<p class="text-sm font-semibold text-slate-900">
									{authorLabel(suggestion)}
								</p>
								<p class="text-sm text-emerald-800">
									{changeCountLabel(suggestion.mutations.length)}
								</p>
							</div>
							<p class="mt-1 text-sm text-slate-500">
								Proposed {createdLabel(suggestion.created_at)}
							</p>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
