<script lang="ts">
	import { page } from '$app/state';
	import BoardWorkspace from '$lib/components/BoardWorkspace.svelte';
	import { readAuth } from '$lib/auth';
	import {
		loadSharedVocabulary,
		sharedVocabularySource,
		type VocabularySource
	} from '$lib/vocabularySource';
	import type { Vocabulary } from '$lib/types';

	const token = $derived(page.params.token ?? '');

	let vocabulary = $state<Vocabulary | null>(null);
	let source = $state<VocabularySource | null>(null);
	let loading = $state(true);
	let unavailable = $state(false);

	// A signed-in User follows a Share Link like anyone else. Saying they
	// already have this points them at their own copy rather than confusing
	// it with what they are looking at.
	const signedIn = $derived(readAuth() != null);

	$effect(() => {
		const current = token;
		let cancelled = false;
		loading = true;
		unavailable = false;

		(async () => {
			try {
				const shared = await loadSharedVocabulary(current);
				if (cancelled) return;
				vocabulary = shared.share.vocabulary;
				source = sharedVocabularySource(shared.content);
			} catch {
				if (cancelled) return;
				// Revoked, deleted, or never real — all the same from out here.
				unavailable = true;
				vocabulary = null;
				source = null;
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head>
	<title>{vocabulary ? vocabulary.displayName : 'Shared vocabulary'}</title>
</svelte:head>

<div class="flex h-screen min-h-0 flex-col bg-slate-50">
	{#if loading}
		<p class="m-auto text-sm text-slate-500">Opening…</p>
	{:else if unavailable}
		<div class="m-auto max-w-md px-6 text-center">
			<h1 class="text-lg font-semibold text-slate-800">This link isn't available</h1>
			<p class="mt-2 text-sm text-slate-600">
				It may have been turned off by the person who shared it. Ask them for a new link.
			</p>
		</div>
	{:else if vocabulary && source}
		<header
			class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3"
		>
			<div class="min-w-0">
				<h1 class="truncate text-base font-semibold text-slate-800">
					{vocabulary.displayName}
				</h1>
				<p class="text-sm text-slate-500">Shared with you — you are not signed in to this.</p>
			</div>
			{#if signedIn}
				<a
					class="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
					href="/vocabularies"
				>
					Your vocabularies
				</a>
			{/if}
		</header>
		<div class="min-h-0 flex-1">
			<BoardWorkspace vocabularyId={vocabulary.id} {source} />
		</div>
	{/if}
</div>
