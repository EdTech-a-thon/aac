<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ApiError, apiFetch, clearAuth, readAuth, type AuthState } from '$lib/auth';
	import type { Vocabulary } from '$lib/types';

	let auth = $state<AuthState | null>(null);
	let vocabularies = $state<Vocabulary[]>([]);
	let newName = $state('');
	let loading = $state(true);
	let creating = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		const current = readAuth();
		if (!current) {
			await goto('/');
			return;
		}
		auth = current;
		await loadVocabularies();
	});

	async function loadVocabularies() {
		if (!auth) return;
		loading = true;
		error = null;
		try {
			const data = await apiFetch<{ vocabularies: Vocabulary[] }>('/vocabularies', {
				accessToken: auth.session.access_token
			});
			vocabularies = data.vocabularies;
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				clearAuth();
				await goto('/');
				return;
			}
			error = err instanceof Error ? err.message : 'Failed to load vocabularies';
		} finally {
			loading = false;
		}
	}

	async function createVocabulary(event: SubmitEvent) {
		event.preventDefault();
		if (!auth) return;
		creating = true;
		error = null;
		try {
			const data = await apiFetch<{ vocabulary: Vocabulary }>('/vocabularies', {
				method: 'POST',
				accessToken: auth.session.access_token,
				body: JSON.stringify({ name: newName })
			});
			newName = '';
			await goto(`/vocabularies/${data.vocabulary.id}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create vocabulary';
		} finally {
			creating = false;
		}
	}

	function signOut() {
		clearAuth();
		goto('/');
	}
</script>

<main class="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100">
	<div class="mx-auto max-w-2xl space-y-6 p-6">
		<header class="flex items-start justify-between gap-4">
			<div>
				<p class="text-sm font-semibold tracking-wide text-blue-600 uppercase">AAC Manager</p>
				<h1 class="mt-1 text-2xl font-semibold text-slate-900">Vocabularies</h1>
				<p class="mt-1 text-sm text-slate-500">
					Signed in as {auth?.user.name ?? auth?.user.email ?? 'User'}
				</p>
			</div>
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				onclick={signOut}
			>
				Sign out
			</button>
		</header>

		<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<form class="flex gap-2" onsubmit={createVocabulary}>
				<input
					class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					type="text"
					placeholder="Name (optional)"
					bind:value={newName}
				/>
				<button
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
					type="submit"
					disabled={creating}
				>
					{creating ? 'Creating…' : 'Create'}
				</button>
			</form>
		</section>

		{#if error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{/if}

		<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			{#if loading}
				<p class="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
			{:else if vocabularies.length === 0}
				<p class="px-5 py-8 text-center text-sm text-slate-500">
					No vocabularies yet. Create one to get started.
				</p>
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each vocabularies as vocabulary (vocabulary.id)}
						<li>
							<a
								class="block px-5 py-3.5 text-sm font-medium text-slate-800 transition hover:bg-blue-50 hover:text-blue-700"
								href={`/vocabularies/${vocabulary.id}`}
							>
								{vocabulary.displayName}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</main>
