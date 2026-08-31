<script lang="ts">
	import { loadGallery, type GalleryListing } from '$lib/vocabularySource';

	let query = $state('');
	let listings = $state<GalleryListing[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searched = $state('');

	async function run(term: string) {
		loading = true;
		error = null;
		try {
			listings = await loadGallery(term);
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
	function gridRange(listing: GalleryListing) {
		if (listing.figures.boardCount === 0) return '';
		const smallest = `${listing.figures.minColumns}×${listing.figures.minRows}`;
		const largest = `${listing.figures.maxColumns}×${listing.figures.maxRows}`;
		return smallest === largest ? smallest : `${smallest} – ${largest}`;
	}
</script>

<svelte:head>
	<title>Gallery</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-6">
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

	{#if loading}
		<p class="text-sm text-slate-500">Loading…</p>
	{:else if error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
	{:else if listings.length === 0}
		<p class="text-sm text-slate-600">
			{searched
				? `Nothing here matches “${searched}”.`
				: 'Nothing has been published yet.'}
		</p>
	{:else}
		<ul class="space-y-3">
			{#each listings as listing (listing.slug)}
				<li>
					<a
						class="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
						href={`/gallery/${listing.slug}`}
					>
						<h2 class="text-base font-semibold text-slate-900">{listing.title}</h2>
						<p class="mt-1 text-sm text-slate-600">{listing.description}</p>
						<p class="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500">
							{#if listing.attribution}<span>{listing.attribution}</span>{/if}
							<span title="Boards">▦ {listing.figures.boardCount}</span>
							<span title="Buttons">◻ {listing.figures.buttonCount}</span>
							{#if gridRange(listing)}<span title="Grid size">⊞ {gridRange(listing)}</span>{/if}
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
