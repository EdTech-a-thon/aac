<script lang="ts">
	import { page } from '$app/state';
	import BoardWorkspace from '$lib/components/BoardWorkspace.svelte';
	import { readAuth } from '$lib/auth';
	import {
		loadPublication,
		sharedVocabularySource,
		type GalleryPublication,
		type VocabularySource
	} from '$lib/vocabularySource';

	const slug = $derived(page.params.slug ?? '');

	let published = $state<GalleryPublication['publication'] | null>(null);
	let source = $state<VocabularySource | null>(null);
	let loading = $state(true);
	let unavailable = $state(false);

	const signedIn = $derived(readAuth() != null);

	// A Publication Version is frozen, so its identifier is a stable name for
	// the content the canvas is showing — it never has to be reconciled with a
	// live Vocabulary, because there is none behind this page.
	const canvasId = $derived(published ? `publication:${published.versionId}` : '');

	const gridRange = $derived.by(() => {
		if (!published || published.figures.boardCount === 0) return '';
		const smallest = `${published.figures.minColumns}×${published.figures.minRows}`;
		const largest = `${published.figures.maxColumns}×${published.figures.maxRows}`;
		return smallest === largest ? smallest : `${smallest} – ${largest}`;
	});

	$effect(() => {
		const current = slug;
		let cancelled = false;
		loading = true;
		unavailable = false;

		(async () => {
			try {
				const payload = await loadPublication(current);
				if (cancelled) return;
				published = payload.publication;
				source = sharedVocabularySource(payload.content);
			} catch {
				if (cancelled) return;
				// Withdrawn, never published, or never real — all the same out here.
				unavailable = true;
				published = null;
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
	<title>{published?.title ?? 'Gallery'}</title>
</svelte:head>

<div class="flex h-screen min-h-0 flex-col bg-slate-50">
	{#if loading}
		<p class="m-auto text-sm text-slate-500">Opening…</p>
	{:else if unavailable}
		<div class="m-auto max-w-md px-6 text-center">
			<h1 class="text-lg font-semibold text-slate-800">This isn't available</h1>
			<p class="mt-2 text-sm text-slate-600">
				It may have been taken off the Gallery by the person who shared it.
			</p>
		</div>
	{:else if published && source}
		<header
			class="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3"
		>
			<div class="min-w-0">
				<h1 class="truncate text-base font-semibold text-slate-800">{published.title}</h1>
				<p class="text-sm text-slate-600">{published.description}</p>
				<p class="mt-0.5 text-xs text-slate-500">
					{#if published.attribution}<span>{published.attribution} · </span>{/if}
					{published.figures.boardCount}
					{published.figures.boardCount === 1 ? 'board' : 'boards'} ·
					{published.figures.buttonCount}
					{published.figures.buttonCount === 1 ? 'button' : 'buttons'}{gridRange
						? ` · ${gridRange}`
						: ''}
				</p>
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
			<BoardWorkspace vocabularyId={canvasId} {source} />
		</div>
	{/if}
</div>
