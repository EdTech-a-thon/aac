<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { setDashboard, type DashboardState } from '$lib/dashboard';
	import { ApiError, apiFetch, clearAuth, readAuth } from '$lib/auth';
	import type { Vocabulary } from '$lib/types';

	let { children } = $props();

	const dashboard = $state<DashboardState>({
		auth: null,
		vocabularies: [],
		loading: true,
		error: null,
		reload,
		addVocabulary,
		replaceVocabulary,
		removeVocabulary
	});

	setDashboard(dashboard);

	let createOpen = $state(false);
	let newName = $state('');
	let creating = $state(false);
	let createError = $state<string | null>(null);

	let renamingId = $state<string | null>(null);
	let renameDraft = $state('');
	let renaming = $state(false);
	let renameInput = $state<HTMLInputElement | null>(null);
	let createNameInput = $state<HTMLInputElement | null>(null);

	const selectedId = $derived(page.params.id ?? null);

	$effect(() => {
		if (renamingId && renameInput) {
			renameInput.focus();
			renameInput.select();
		}
	});

	$effect(() => {
		if (createOpen && createNameInput) {
			createNameInput.focus();
		}
	});

	async function reload() {
		if (!dashboard.auth) return;
		dashboard.loading = true;
		dashboard.error = null;
		try {
			const data = await apiFetch<{ vocabularies: Vocabulary[] }>('/vocabularies', {
				accessToken: dashboard.auth.session.access_token
			});
			dashboard.vocabularies = data.vocabularies;
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				clearAuth();
				await goto('/');
				return;
			}
			dashboard.error = err instanceof Error ? err.message : 'Failed to load vocabularies';
		} finally {
			dashboard.loading = false;
		}
	}

	function addVocabulary(vocabulary: Vocabulary) {
		dashboard.vocabularies = [
			vocabulary,
			...dashboard.vocabularies.filter((v) => v.id !== vocabulary.id)
		];
	}

	function replaceVocabulary(vocabulary: Vocabulary) {
		dashboard.vocabularies = dashboard.vocabularies.map((v) =>
			v.id === vocabulary.id ? vocabulary : v
		);
	}

	function removeVocabulary(id: string) {
		dashboard.vocabularies = dashboard.vocabularies.filter((v) => v.id !== id);
	}

	onMount(async () => {
		const current = readAuth();
		if (!current) {
			await goto('/');
			return;
		}
		dashboard.auth = current;
		await reload();
	});

	function signOut() {
		clearAuth();
		goto('/');
	}

	function openCreate() {
		newName = '';
		createError = null;
		createOpen = true;
	}

	async function createVocabulary(event: SubmitEvent) {
		event.preventDefault();
		if (!dashboard.auth) return;
		creating = true;
		createError = null;
		try {
			const data = await apiFetch<{ vocabulary: Vocabulary }>('/vocabularies', {
				method: 'POST',
				accessToken: dashboard.auth.session.access_token,
				body: JSON.stringify({ name: newName })
			});
			addVocabulary(data.vocabulary);
			createOpen = false;
			newName = '';
			await goto(`/vocabularies/${data.vocabulary.id}`);
		} catch (err) {
			createError = err instanceof Error ? err.message : 'Failed to create vocabulary';
		} finally {
			creating = false;
		}
	}

	function startRename(vocabulary: Vocabulary) {
		renamingId = vocabulary.id;
		renameDraft = vocabulary.name;
	}

	function cancelRename() {
		renamingId = null;
		renameDraft = '';
	}

	async function saveRename(vocabularyId: string) {
		if (!dashboard.auth || renaming) return;
		renaming = true;
		dashboard.error = null;
		try {
			const data = await apiFetch<{ vocabulary: Vocabulary }>(`/vocabularies/${vocabularyId}`, {
				method: 'PATCH',
				accessToken: dashboard.auth.session.access_token,
				body: JSON.stringify({ name: renameDraft })
			});
			replaceVocabulary(data.vocabulary);
			renamingId = null;
			renameDraft = '';
		} catch (err) {
			dashboard.error = err instanceof Error ? err.message : 'Failed to rename vocabulary';
		} finally {
			renaming = false;
		}
	}
</script>

<div class="grid h-screen grid-cols-[16rem_1fr] grid-rows-[3rem_1fr] overflow-hidden bg-slate-100">
	<header
		class="col-span-2 flex items-center justify-between gap-4 bg-blue-600 px-4 text-white shadow-sm"
	>
		<a href="/vocabularies" class="text-sm font-semibold tracking-wide">AAC Manager</a>
		<div class="flex items-center gap-3">
			<span class="hidden text-sm text-blue-100 sm:inline">
				{dashboard.auth?.user.name ?? dashboard.auth?.user.email ?? 'User'}
			</span>
			<button
				type="button"
				class="rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium transition hover:bg-blue-400"
				onclick={signOut}
			>
				Sign out
			</button>
		</div>
	</header>

	<aside class="flex min-h-0 flex-col border-r border-slate-200 bg-white">
		<div class="border-b border-slate-100 p-3">
			<button
				type="button"
				class="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
				onclick={openCreate}
			>
				+ New vocabulary
			</button>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-2">
			{#if dashboard.loading}
				<p class="px-2 py-4 text-center text-sm text-slate-500">Loading…</p>
			{:else if dashboard.vocabularies.length === 0}
				<p class="px-2 py-4 text-center text-sm text-slate-500">No vocabularies yet</p>
			{:else}
				<ul class="space-y-0.5">
					{#each dashboard.vocabularies as vocabulary (vocabulary.id)}
						<li>
							{#if renamingId === vocabulary.id}
								<form
									class="flex items-center gap-1 rounded-lg bg-slate-50 p-1"
									onsubmit={(event) => {
										event.preventDefault();
										saveRename(vocabulary.id);
									}}
								>
									<input
										bind:this={renameInput}
										class="min-w-0 flex-1 rounded-md border border-blue-400 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
										type="text"
										placeholder="Untitled"
										bind:value={renameDraft}
										disabled={renaming}
										onkeydown={(event) => {
											if (event.key === 'Escape') cancelRename();
										}}
										onblur={() => {
											if (renamingId === vocabulary.id && !renaming) {
												saveRename(vocabulary.id);
											}
										}}
									/>
								</form>
							{:else}
								<div
									class="group flex items-center gap-1 rounded-lg transition {selectedId ===
									vocabulary.id
										? 'bg-blue-50 text-blue-800'
										: 'text-slate-700 hover:bg-slate-50'}"
								>
									<a
										href={`/vocabularies/${vocabulary.id}`}
										class="min-w-0 flex-1 truncate px-2.5 py-2 text-sm font-medium"
									>
										{vocabulary.displayName}
									</a>
									<div
										class="pr-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
									>
										<Menu>
											{#snippet trigger({ toggle })}
												<button
													type="button"
													class="rounded-md px-1.5 py-1 text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800"
													aria-label="Vocabulary options"
													onclick={(event) => {
														event.preventDefault();
														event.stopPropagation();
														toggle();
													}}
												>
													⋯
												</button>
											{/snippet}
											{#snippet children({ close })}
												<button
													type="button"
													class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
													onclick={() => {
														close();
														startRename(vocabulary);
													}}
												>
													Rename
												</button>
											{/snippet}
										</Menu>
									</div>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if dashboard.error}
			<p class="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{dashboard.error}</p>
		{/if}
	</aside>

	<main class="min-h-0 overflow-auto bg-slate-50">
		{@render children()}
	</main>
</div>

<Modal bind:open={createOpen} title="New vocabulary">
	<form class="space-y-4" id="create-vocabulary-form" onsubmit={createVocabulary}>
		<label class="block space-y-1.5">
			<span class="text-sm font-medium text-slate-700">Name</span>
			<input
				bind:this={createNameInput}
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="text"
				placeholder="Untitled"
				bind:value={newName}
			/>
		</label>
		{#if createError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>
		{/if}
	</form>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			onclick={() => (createOpen = false)}
		>
			Cancel
		</button>
		<button
			type="submit"
			form="create-vocabulary-form"
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={creating}
		>
			{creating ? 'Creating…' : 'Create'}
		</button>
	{/snippet}
</Modal>
