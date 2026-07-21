<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BoardWorkspace from '$lib/components/BoardWorkspace.svelte';
	import { getDashboard } from '$lib/dashboard';
	import { ApiError, apiFetch, clearAuth } from '$lib/auth';
	import type { Manager, Vocabulary } from '$lib/types';

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');

	let vocabulary = $state<Vocabulary | null>(null);
	let nameDraft = $state('');
	let managers = $state<Manager[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let savingName = $state(false);

	let shareOpen = $state(false);
	let inviteEmail = $state('');
	let inviting = $state(false);
	let shareError = $state<string | null>(null);
	let shareMessage = $state<string | null>(null);

	let deleteOpen = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	$effect(() => {
		const id = vocabularyId;
		const auth = dashboard.auth;
		if (!id || !auth) return;

		let cancelled = false;

		(async () => {
			loading = true;
			error = null;
			try {
				const [vocabData, managersData] = await Promise.all([
					apiFetch<{ vocabulary: Vocabulary }>(`/vocabularies/${id}`, {
						accessToken: auth.session.access_token
					}),
					apiFetch<{ managers: Manager[] }>(`/vocabularies/${id}/managers`, {
						accessToken: auth.session.access_token
					})
				]);
				if (cancelled) return;
				vocabulary = vocabData.vocabulary;
				nameDraft = vocabData.vocabulary.name;
				managers = managersData.managers;
			} catch (err) {
				if (cancelled) return;
				if (err instanceof ApiError && err.status === 401) {
					clearAuth();
					await goto('/');
					return;
				}
				vocabulary = null;
				error = err instanceof Error ? err.message : 'Failed to load vocabulary';
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const fromList = dashboard.vocabularies.find((v) => v.id === vocabularyId);
		if (!fromList || !vocabulary || vocabulary.id !== fromList.id) return;
		if (fromList.updated_at === vocabulary.updated_at) return;
		vocabulary = fromList;
		if (!savingName) nameDraft = fromList.name;
	});

	async function saveName() {
		if (!dashboard.auth || !vocabulary || savingName) return;
		if (nameDraft === vocabulary.name) return;

		savingName = true;
		error = null;
		try {
			const data = await apiFetch<{ vocabulary: Vocabulary }>(`/vocabularies/${vocabulary.id}`, {
				method: 'PATCH',
				accessToken: dashboard.auth.session.access_token,
				body: JSON.stringify({ name: nameDraft })
			});
			vocabulary = data.vocabulary;
			nameDraft = data.vocabulary.name;
			dashboard.replaceVocabulary(data.vocabulary);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save name';
			nameDraft = vocabulary.name;
		} finally {
			savingName = false;
		}
	}

	function openShare() {
		inviteEmail = '';
		shareError = null;
		shareMessage = null;
		shareOpen = true;
	}

	async function inviteManager(event: SubmitEvent) {
		event.preventDefault();
		if (!dashboard.auth || !vocabulary) return;
		inviting = true;
		shareError = null;
		shareMessage = null;
		try {
			const data = await apiFetch<{ managers: Manager[] }>(
				`/vocabularies/${vocabulary.id}/managers`,
				{
					method: 'POST',
					accessToken: dashboard.auth.session.access_token,
					body: JSON.stringify({ email: inviteEmail })
				}
			);
			managers = data.managers;
			inviteEmail = '';
			shareMessage = 'Manager added.';
		} catch (err) {
			shareError = err instanceof Error ? err.message : 'Failed to add manager';
		} finally {
			inviting = false;
		}
	}

	async function removeManager(userId: string) {
		if (!dashboard.auth || !vocabulary) return;
		shareError = null;
		shareMessage = null;
		try {
			await apiFetch(`/vocabularies/${vocabulary.id}/managers/${userId}`, {
				method: 'DELETE',
				accessToken: dashboard.auth.session.access_token
			});
			managers = managers.filter((m) => m.userId !== userId);
			shareMessage = 'Manager removed.';
		} catch (err) {
			shareError = err instanceof Error ? err.message : 'Failed to remove manager';
		}
	}

	async function deleteVocabulary() {
		if (!dashboard.auth || !vocabulary) return;
		deleting = true;
		deleteError = null;
		try {
			const id = vocabulary.id;
			await apiFetch(`/vocabularies/${id}`, {
				method: 'DELETE',
				accessToken: dashboard.auth.session.access_token
			});
			dashboard.removeVocabulary(id);
			deleteOpen = false;
			await goto('/vocabularies');
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete vocabulary';
			deleting = false;
		}
	}
</script>

{#if loading}
	<div class="flex h-full items-center justify-center p-8">
		<p class="text-sm text-slate-500">Loading…</p>
	</div>
{:else if !vocabulary}
	<div class="flex h-full items-center justify-center p-8">
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
			{error ?? 'Vocabulary not found'}
		</p>
	</div>
{:else}
	<div class="grid h-full grid-rows-[auto_1fr]">
		<header
			class="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
		>
			<input
				class="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold text-slate-900 outline-none transition hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
				type="text"
				placeholder="Untitled"
				bind:value={nameDraft}
				disabled={savingName}
				onblur={saveName}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						(event.currentTarget as HTMLInputElement).blur();
					}
					if (event.key === 'Escape') {
						nameDraft = vocabulary?.name ?? '';
						(event.currentTarget as HTMLInputElement).blur();
					}
				}}
			/>

			<button
				type="button"
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
				onclick={openShare}
			>
				Share
			</button>

			<Menu>
				{#snippet trigger({ toggle })}
					<button
						type="button"
						class="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
						aria-label="Vocabulary menu"
						onclick={toggle}
					>
						⋯
					</button>
				{/snippet}
				{#snippet children({ close })}
					<button
						type="button"
						class="block w-full px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
						onclick={() => {
							close();
							deleteError = null;
							deleteOpen = true;
						}}
					>
						Delete vocabulary
					</button>
				{/snippet}
			</Menu>
		</header>

		<div class="min-h-0 overflow-hidden">
			{#if error}
				<p class="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
			{/if}
			{#if dashboard.auth}
				<BoardWorkspace vocabularyId={vocabulary.id} auth={dashboard.auth} />
			{/if}
		</div>
	</div>
{/if}

<Modal bind:open={shareOpen} title="Share vocabulary">
	<div class="space-y-4">
		<ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
			{#each managers as manager (manager.userId)}
				<li class="flex items-center justify-between gap-3 px-3 py-2.5">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-slate-800">
							{manager.name ?? manager.email ?? manager.userId}
						</p>
						{#if manager.name && manager.email}
							<p class="truncate text-sm text-slate-500">{manager.email}</p>
						{/if}
					</div>
					<button
						type="button"
						class="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={managers.length <= 1}
						onclick={() => removeManager(manager.userId)}
					>
						Remove
					</button>
				</li>
			{/each}
		</ul>

		<form class="flex gap-2" onsubmit={inviteManager}>
			<input
				class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="email"
				placeholder="Invite by email"
				required
				bind:value={inviteEmail}
			/>
			<button
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
				type="submit"
				disabled={inviting}
			>
				{inviting ? 'Adding…' : 'Add'}
			</button>
		</form>

		{#if shareMessage}
			<p class="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{shareMessage}</p>
		{/if}
		{#if shareError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{shareError}</p>
		{/if}

		<p class="text-sm text-slate-500">
			The person must already have an account. A vocabulary always keeps at least one manager.
		</p>
	</div>
</Modal>

<Modal bind:open={deleteOpen} title="Delete vocabulary">
	<div class="space-y-3">
		<p class="text-sm text-slate-600">
			Delete “{vocabulary?.displayName ?? 'Untitled'}”? This cannot be undone.
		</p>
		{#if deleteError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
		{/if}
	</div>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			onclick={() => (deleteOpen = false)}
			disabled={deleting}
		>
			Cancel
		</button>
		<button
			type="button"
			class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
			onclick={deleteVocabulary}
			disabled={deleting}
		>
			{deleting ? 'Deleting…' : 'Delete'}
		</button>
	{/snippet}
</Modal>
