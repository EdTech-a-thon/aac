<script lang="ts">
	import { loadGallery, type PublicationSummary } from '$lib/vocabularySource';
	import VoiceCommonsBrand from '$lib/components/VoiceCommonsBrand.svelte';

	let query = $state('');
	let publications = $state<PublicationSummary[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searched = $state('');
	let sort = $state<'endorsed' | 'newest'>('endorsed');

	async function run(term: string) {
		loading = true;
		error = null;
		try {
			publications = await loadGallery(term, sort);
			searched = term.trim();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not open the Gallery';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void run('');
	});

	/** "4×3" when every Board matches, "2×2 – 8×6" when they do not. */
	function gridRange(publication: PublicationSummary) {
		if (publication.figures.boardCount === 0) return '';
		const smallest = `${publication.figures.minColumns}×${publication.figures.minRows}`;
		const largest = `${publication.figures.maxColumns}×${publication.figures.maxRows}`;
		return smallest === largest ? smallest : `${smallest} – ${largest}`;
	}
</script>

<svelte:head>
	<title>Gallery</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-6">
	<a class="w-fit no-underline" href="/" aria-label="VoiceCommons home">
		<VoiceCommonsBrand compact />
	</a>

	<header class="space-y-1">
		<h1 class="text-2xl font-semibold text-slate-900">Gallery</h1>
		<p class="text-sm text-slate-600">
			Vocabularies people have published for anyone to try and keep a copy of.
		</p>
	</header>

	<form
		class="flex gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			void run(query);
		}}
	>
		<input
			class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
			type="search"
			placeholder="Search titles and descriptions"
			bind:value={query}
		/>
		<button
			class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
			type="submit"
		>
			Search
		</button>
	</form>

	<div class="flex gap-1 text-sm">
		{#each [{ key: 'endorsed', label: 'Most endorsed' }, { key: 'newest', label: 'Newest' }] as tab (tab.key)}
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 font-medium transition {sort === tab.key
					? 'bg-slate-200 text-slate-900'
					: 'text-slate-600 hover:bg-slate-100'}"
				onclick={() => {
					sort = tab.key as 'endorsed' | 'newest';
					void run(query);
				}}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if loading}
		<p class="text-sm text-slate-500">Loading…</p>
	{:else if error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
	{:else if publications.length === 0}
		<p class="text-sm text-slate-600">
			{searched
				? `Nothing here matches “${searched}”.`
				: 'Nothing has been published yet.'}
		</p>
	{:else}
		<ul class="space-y-3">
			{#each publications as publication (publication.slug)}
				<li>
					<a
						class="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
						href={`/gallery/${publication.slug}`}
					>
						<h2 class="text-base font-semibold text-slate-900">{publication.title}</h2>
						<p class="mt-1 text-sm text-slate-600">{publication.description}</p>
						<p class="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500">
							{#if publication.attribution}<span>{publication.attribution}</span>{/if}
							<span title="Endorsements">Endorsed · {publication.endorsementCount}</span>
							<span title="Boards">▦ {publication.figures.boardCount}</span>
							<span title="Buttons">◻ {publication.figures.buttonCount}</span>
							{#if gridRange(publication)}<span title="Grid size">⊞ {gridRange(publication)}</span>{/if}
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
