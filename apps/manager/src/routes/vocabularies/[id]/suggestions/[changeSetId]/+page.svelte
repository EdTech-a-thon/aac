<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getDashboard } from '$lib/dashboard';
	import { ApiError, apiFetch, clearAuth } from '$lib/auth';
	import { normalizeSuggestedChangeSets } from '$lib/describeChangeSetMutations';
	import { groupSuggestedChanges } from '$lib/groupSuggestedChanges';
	import { projectVocabulary } from '$lib/projectVocabulary';
	import SuggestedBoardPreview from '$lib/components/SuggestedBoardPreview.svelte';
	import {
		getVocabularyEditorSession,
		persistEditorSession,
		rebaseEditorOntoLiveFromServer,
		replaceEditorLiveFromServer,
		subscribeEditorRevision,
		type SuggestedChangeSet
	} from '$lib/vocabularyEditorSession';
	import type { Board, BoardButton, PaletteColor } from '$lib/types';

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');
	const changeSetId = $derived(page.params.changeSetId ?? '');

	let revision = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let changeSet = $state<SuggestedChangeSet | null>(null);
	let acting = $state(false);

	$effect(() => subscribeEditorRevision(() => {
		revision += 1;
	}));

	const session = $derived(getVocabularyEditorSession(vocabularyId));

	const changeGroups = $derived.by(() => {
		revision;
		if (!changeSet) return [];
		const buttons = Object.values(session.baseButtonsByBoardId).flat();
		return groupSuggestedChanges(changeSet.mutations, {
			boards: session.baseBoards,
			buttons,
			paletteColors: session.basePaletteColors
		});
	});

	const paletteById = $derived.by(() => {
		revision;
		const colors = !changeSet
			? session.basePaletteColors
			: projectVocabulary(
					{
						vocabularyId,
						boards: session.baseBoards,
						buttons: Object.values(session.baseButtonsByBoardId).flat(),
						paletteColors: session.basePaletteColors
					},
					changeSet.mutations
				).paletteColors;
		const map: Record<string, string> = {};
		for (const color of colors) {
			map[color.id] = color.hex;
		}
		return map;
	});

	async function hydrateForPreview(id: string, accessToken: string) {
		const current = getVocabularyEditorSession(id);
		const [boardData, paletteData, suggested] = await Promise.all([
			apiFetch<{ boards: Board[] }>(`/vocabularies/${id}/boards`, { accessToken }),
			apiFetch<{ paletteColors: PaletteColor[] }>(`/vocabularies/${id}/palette-colors`, {
				accessToken
			}),
			apiFetch<{ changeSets: SuggestedChangeSet[] }>(
				`/vocabularies/${id}/change-sets?status=suggested`,
				{ accessToken }
			)
		]);
		const nextButtonsByBoardId: Record<string, BoardButton[]> = {};
		await Promise.all(
			boardData.boards.map(async (board) => {
				const buttonData = await apiFetch<{ buttons: BoardButton[] }>(
					`/vocabularies/${id}/boards/${board.id}/buttons`,
					{ accessToken }
				);
				nextButtonsByBoardId[board.id] = buttonData.buttons;
			})
		);

		const normalized = normalizeSuggestedChangeSets(suggested.changeSets);
		if (!current.hydrated) {
			replaceEditorLiveFromServer(
				current,
				boardData.boards,
				nextButtonsByBoardId,
				paletteData.paletteColors
			);
		} else if (!current.paletteHydrated) {
			persistEditorSession(current, {
				paletteColors: paletteData.paletteColors,
				basePaletteColors: paletteData.paletteColors,
				paletteHydrated: true
			});
		}
		persistEditorSession(current, { suggestedChangeSets: normalized });
		return normalized;
	}

	$effect(() => {
		const id = vocabularyId;
		const csId = changeSetId;
		const auth = dashboard.auth;
		if (!id || !csId || !auth) return;

		let cancelled = false;
		(async () => {
			loading = true;
			error = null;
			actionError = null;
			try {
				const current = getVocabularyEditorSession(id);
				const list =
					current.hydrated && current.suggestedChangeSets.some((cs) => cs.id === csId)
						? current.suggestedChangeSets
						: await hydrateForPreview(id, auth.session.access_token);
				if (cancelled) return;
				const found = list.find((cs) => cs.id === csId) ?? null;
				changeSet = found ?? null;
				if (!found) error = 'Suggestion not found';
			} catch (err) {
				if (cancelled) return;
				if (err instanceof ApiError && err.status === 401) {
					clearAuth();
					await goto('/');
					return;
				}
				changeSet = null;
				error = err instanceof Error ? err.message : 'Failed to load suggestion';
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	async function reloadSuggestedChangeSets() {
		if (!dashboard.auth) return;
		const data = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
			`/vocabularies/${vocabularyId}/change-sets?status=suggested`,
			{ accessToken: dashboard.auth.session.access_token }
		);
		const normalized = normalizeSuggestedChangeSets(data.changeSets);
		persistEditorSession(session, { suggestedChangeSets: normalized });
		return normalized;
	}

	async function reloadLiveBoardsAndButtons() {
		if (!dashboard.auth) return;
		const [boardData, paletteData] = await Promise.all([
			apiFetch<{ boards: Board[] }>(`/vocabularies/${vocabularyId}/boards`, {
				accessToken: dashboard.auth.session.access_token
			}),
			apiFetch<{ paletteColors: PaletteColor[] }>(
				`/vocabularies/${vocabularyId}/palette-colors`,
				{ accessToken: dashboard.auth.session.access_token }
			)
		]);
		const nextButtonsByBoardId: Record<string, BoardButton[]> = {};
		await Promise.all(
			boardData.boards.map(async (board) => {
				const buttonData = await apiFetch<{ buttons: BoardButton[] }>(
					`/vocabularies/${vocabularyId}/boards/${board.id}/buttons`,
					{ accessToken: dashboard.auth.session.access_token }
				);
				nextButtonsByBoardId[board.id] = buttonData.buttons;
			})
		);
		rebaseEditorOntoLiveFromServer(
			session,
			boardData.boards,
			nextButtonsByBoardId,
			paletteData.paletteColors
		);
	}

	async function applySuggestion() {
		if (!dashboard.auth || !changeSet || acting) return;
		acting = true;
		actionError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/change-sets/${changeSet.id}/apply`, {
				method: 'POST',
				accessToken: dashboard.auth.session.access_token
			});
			await reloadLiveBoardsAndButtons();
			await reloadSuggestedChangeSets();
			await goto(`/vocabularies/${vocabularyId}`);
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Failed to apply suggestion';
		} finally {
			acting = false;
		}
	}

	async function deleteSuggestion() {
		if (!dashboard.auth || !changeSet || acting) return;
		acting = true;
		actionError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/change-sets/${changeSet.id}`, {
				method: 'DELETE',
				accessToken: dashboard.auth.session.access_token
			});
			await reloadSuggestedChangeSets();
			await goto(`/vocabularies/${vocabularyId}`);
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Failed to delete suggestion';
		} finally {
			acting = false;
		}
	}

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
</script>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-auto">
	<header
		class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
	>
		<div>
			<a
				href={`/vocabularies/${vocabularyId}/suggestions`}
				class="text-sm font-medium text-emerald-700 hover:underline"
			>
				← Back to suggestions
			</a>
			<h1 class="mt-1 text-xl font-semibold text-slate-900">Suggestion</h1>
			{#if changeSet}
				<p class="mt-1 text-sm text-slate-600">
					{authorLabel(changeSet)} · Proposed {createdLabel(changeSet.created_at)} ·
					{changeSet.mutations.length}
					{changeSet.mutations.length === 1 ? 'change' : 'changes'}
				</p>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if changeSet && !loading && !error}
				<button
					type="button"
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={acting}
					onclick={deleteSuggestion}
				>
					{acting ? 'Working…' : 'Delete'}
				</button>
				<button
					type="button"
					class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={acting}
					onclick={applySuggestion}
				>
					{acting ? 'Working…' : 'Apply'}
				</button>
			{/if}
		</div>
	</header>

	<div class="flex flex-col gap-4 p-6">
	{#if loading}
		<p class="text-sm text-slate-500">Loading suggestion…</p>
	{:else if error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
	{:else if changeSet}
		{#if actionError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
		{/if}

		{#if changeGroups.length === 0}
			<p class="text-sm text-slate-500">This suggestion has no changes.</p>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				{#each changeGroups as group (group.key)}
					{#if group.kind === 'create_board'}
						<article class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
							<h2 class="text-sm font-semibold text-slate-900">{group.summary}</h2>
							<SuggestedBoardPreview
								width={group.width}
								height={group.height}
								buttons={group.buttons}
								overlays={group.overlays}
								paletteById={paletteById}
								markerId={group.key}
								created
							/>
							{#if group.changeLines.length > 0}
								<ul class="space-y-1.5 text-sm text-slate-700">
									{#each group.changeLines as line, index (index)}
										<li class="flex gap-2">
											<span class="text-slate-400">•</span>
											<span>{line}</span>
										</li>
									{/each}
								</ul>
							{/if}
						</article>
					{:else if group.kind === 'delete_board'}
						<article class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
							<h2 class="text-sm font-semibold text-slate-900">{group.summary}</h2>
							<SuggestedBoardPreview
								width={group.width}
								height={group.height}
								buttons={group.buttons}
								paletteById={paletteById}
								markerId={group.key}
								deleted
							/>
							<ul class="space-y-1.5 text-sm text-slate-700">
								{#each group.changeLines as line, index (index)}
									<li class="flex gap-2">
										<span class="text-slate-400">•</span>
										<span>{line}</span>
									</li>
								{/each}
							</ul>
						</article>
					{:else if group.kind === 'board'}
						<article class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
							<h2 class="text-sm font-semibold text-slate-900">{group.summary}</h2>
							<SuggestedBoardPreview
								width={group.width}
								height={group.height}
								buttons={group.buttons}
								overlays={group.overlays}
								paletteById={paletteById}
								markerId={group.key}
							/>
							<ul class="space-y-1.5 text-sm text-slate-700">
								{#each group.changeLines as line, index (index)}
									<li class="flex gap-2">
										<span class="text-slate-400">•</span>
										<span>{line}</span>
									</li>
								{/each}
							</ul>
						</article>
					{:else}
						<article
							class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:col-span-2"
						>
							<h2 class="text-sm font-semibold text-slate-900">Palette</h2>
							<ul class="space-y-1.5 text-sm text-slate-700">
								{#each group.changeLines as line, index (index)}
									<li class="flex gap-2">
										<span class="text-slate-400">•</span>
										<span>{line}</span>
									</li>
								{/each}
							</ul>
						</article>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
	</div>
</div>
