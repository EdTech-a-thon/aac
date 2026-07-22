<script lang="ts">
	import { page } from '$app/state';
	import { getDashboard } from '$lib/dashboard';
	import { apiFetch } from '$lib/auth';
	import type { PaletteColor } from '$lib/types';

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');

	let paletteColors = $state<PaletteColor[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		const id = vocabularyId;
		const auth = dashboard.auth;
		if (!id || !auth) return;

		let cancelled = false;
		(async () => {
			loading = true;
			error = null;
			try {
				const data = await apiFetch<{ paletteColors: PaletteColor[] }>(
					`/vocabularies/${id}/palette-colors`,
					{ accessToken: auth.session.access_token }
				);
				if (!cancelled) paletteColors = data.paletteColors;
			} catch (err) {
				if (!cancelled) {
					error = err instanceof Error ? err.message : 'Failed to load palette';
				}
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="flex h-full flex-col gap-4 overflow-auto p-6">
	<div>
		<a
			href={`/vocabularies/${vocabularyId}`}
			class="text-sm font-medium text-blue-700 hover:underline"
		>
			← Back to boards
		</a>
		<h1 class="mt-3 text-2xl font-semibold text-slate-900">Settings</h1>
		<p class="mt-1 text-sm text-slate-600">
			Vocabulary settings. Palette editing comes next; the live Palette is shown below.
		</p>
	</div>

	<section class="space-y-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Palette</h2>
		{#if loading}
			<p class="text-sm text-slate-500">Loading palette…</p>
		{:else if error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{:else if paletteColors.length === 0}
			<p class="text-sm text-slate-500">This Vocabulary has no Palette Colors.</p>
		{:else}
			<ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
				{#each paletteColors as color (color.id)}
					<li class="flex items-start gap-3 px-3 py-3">
						<span
							class="mt-0.5 size-8 shrink-0 rounded-md border border-slate-200 shadow-sm"
							style={`background-color: ${color.hex};`}
							aria-hidden="true"
						></span>
						<div class="min-w-0">
							<p class="text-sm font-medium text-slate-800">
								{color.name.trim() ? color.name : 'Untitled color'}
							</p>
							<p class="font-mono text-xs text-slate-500">{color.hex}</p>
							{#if color.description.trim()}
								<p class="mt-1 text-sm text-slate-600">{color.description}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
