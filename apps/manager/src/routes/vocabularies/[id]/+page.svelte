<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { ApiError, apiFetch, clearAuth, readAuth, type AuthState } from '$lib/auth';
	import type { Manager, Vocabulary } from '$lib/types';

	let auth = $state<AuthState | null>(null);
	let vocabulary = $state<Vocabulary | null>(null);
	let managers = $state<Manager[]>([]);
	let nameDraft = $state('');
	let inviteEmail = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let inviting = $state(false);
	let deleting = $state(false);
	let error = $state<string | null>(null);
	let message = $state<string | null>(null);

	const vocabularyId = $derived(page.params.id ?? '');

	onMount(async () => {
		const current = readAuth();
		if (!current) {
			await goto('/');
			return;
		}
		auth = current;
		await load();
	});

	async function load() {
		if (!auth || !vocabularyId) return;
		loading = true;
		error = null;
		try {
			const [vocabData, managersData] = await Promise.all([
				apiFetch<{ vocabulary: Vocabulary }>(`/vocabularies/${vocabularyId}`, {
					accessToken: auth.session.access_token
				}),
				apiFetch<{ managers: Manager[] }>(`/vocabularies/${vocabularyId}/managers`, {
					accessToken: auth.session.access_token
				})
			]);
			vocabulary = vocabData.vocabulary;
			nameDraft = vocabData.vocabulary.name;
			managers = managersData.managers;
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				clearAuth();
				await goto('/');
				return;
			}
			error = err instanceof Error ? err.message : 'Failed to load vocabulary';
		} finally {
			loading = false;
		}
	}

	async function saveName(event: SubmitEvent) {
		event.preventDefault();
		if (!auth || !vocabulary) return;
		saving = true;
		error = null;
		message = null;
		try {
			const data = await apiFetch<{ vocabulary: Vocabulary }>(`/vocabularies/${vocabulary.id}`, {
				method: 'PATCH',
				accessToken: auth.session.access_token,
				body: JSON.stringify({ name: nameDraft })
			});
			vocabulary = data.vocabulary;
			message = 'Name saved.';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save name';
		} finally {
			saving = false;
		}
	}

	async function inviteManager(event: SubmitEvent) {
		event.preventDefault();
		if (!auth || !vocabulary) return;
		inviting = true;
		error = null;
		message = null;
		try {
			const data = await apiFetch<{ managers: Manager[] }>(
				`/vocabularies/${vocabulary.id}/managers`,
				{
					method: 'POST',
					accessToken: auth.session.access_token,
					body: JSON.stringify({ email: inviteEmail })
				}
			);
			managers = data.managers;
			inviteEmail = '';
			message = 'Manager added.';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add manager';
		} finally {
			inviting = false;
		}
	}

	async function removeManager(userId: string) {
		if (!auth || !vocabulary) return;
		error = null;
		message = null;
		try {
			await apiFetch(`/vocabularies/${vocabulary.id}/managers/${userId}`, {
				method: 'DELETE',
				accessToken: auth.session.access_token
			});
			managers = managers.filter((m) => m.userId !== userId);
			message = 'Manager removed.';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove manager';
		}
	}

	async function deleteVocabulary() {
		if (!auth || !vocabulary) return;
		const label = vocabulary.displayName;
		if (!confirm(`Delete “${label}”? This cannot be undone.`)) return;

		deleting = true;
		error = null;
		try {
			await apiFetch(`/vocabularies/${vocabulary.id}`, {
				method: 'DELETE',
				accessToken: auth.session.access_token
			});
			await goto('/vocabularies');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete vocabulary';
			deleting = false;
		}
	}
</script>

<main class="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100">
	<div class="mx-auto max-w-2xl space-y-6 p-6">
		<p>
			<a
				class="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
				href="/vocabularies"
			>
				← Vocabularies
			</a>
		</p>

		{#if loading}
			<p class="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
				Loading…
			</p>
		{:else if !vocabulary}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
				{error ?? 'Vocabulary not found'}
			</p>
		{:else}
			<header>
				<p class="text-sm font-semibold tracking-wide text-blue-600 uppercase">Vocabulary</p>
				<h1 class="mt-1 text-2xl font-semibold text-slate-900">{vocabulary.displayName}</h1>
				<p class="mt-1 text-sm text-slate-500">Edit name and managers</p>
			</header>

			{#if message}
				<p class="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>
			{/if}
			{#if error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
			{/if}

			<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="text-sm font-semibold text-slate-900">Name</h2>
				<form class="flex gap-2" onsubmit={saveName}>
					<input
						class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						type="text"
						bind:value={nameDraft}
					/>
					<button
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
						type="submit"
						disabled={saving}
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</form>
				<p class="text-sm text-slate-500">Blank names show as Untitled.</p>
			</section>

			<section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="text-sm font-semibold text-slate-900">Managers</h2>
				<ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
					{#each managers as manager (manager.userId)}
						<li class="flex items-center justify-between gap-3 px-4 py-3">
							<div>
								<p class="text-sm font-medium text-slate-800">
									{manager.name ?? manager.email ?? manager.userId}
								</p>
								{#if manager.name && manager.email}
									<p class="text-sm text-slate-500">{manager.email}</p>
								{/if}
							</div>
							<button
								type="button"
								class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
						class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
				<p class="text-sm text-slate-500">
					The person must already have an account. A vocabulary always keeps at least one manager.
				</p>
			</section>

			<section class="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-5">
				<h2 class="text-sm font-semibold text-red-800">Danger zone</h2>
				<button
					type="button"
					class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={deleting}
					onclick={deleteVocabulary}
				>
					{deleting ? 'Deleting…' : 'Delete vocabulary'}
				</button>
			</section>
		{/if}
	</div>
</main>
