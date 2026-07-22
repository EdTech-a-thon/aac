<script lang="ts">
	import { apiFetch, type AuthState } from '$lib/auth';
	import {
		acceptEditorBase,
		discardEditorChanges,
		getVocabularyEditorSession,
		isEditorDirty,
		pendingEditorMutations,
		persistEditorSession,
		replaceEditorLiveFromServer,
		subscribeEditorRevision,
		type SuggestedChangeSet
	} from '$lib/vocabularyEditorSession';
	import type { Board, BoardButton, PaletteColor } from '$lib/types';

	let {
		vocabularyId,
		auth
	}: {
		vocabularyId: string;
		auth: AuthState;
	} = $props();

	let revision = $state(0);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let suggestionActionId = $state<string | null>(null);

	$effect(() => subscribeEditorRevision(() => {
		revision += 1;
	}));

	const session = $derived(getVocabularyEditorSession(vocabularyId));
	const isDirty = $derived.by(() => {
		revision;
		return isEditorDirty(session);
	});
	const suggestedChangeSets = $derived.by(() => {
		revision;
		return session.suggestedChangeSets;
	});

	async function reloadSuggestedChangeSets() {
		const data = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
			`/vocabularies/${vocabularyId}/change-sets?status=suggested`,
			{ accessToken: auth.session.access_token }
		);
		persistEditorSession(session, { suggestedChangeSets: data.changeSets });
	}

	async function reloadLiveBoardsAndButtons() {
		const [boardData, paletteData] = await Promise.all([
			apiFetch<{ boards: Board[] }>(`/vocabularies/${vocabularyId}/boards`, {
				accessToken: auth.session.access_token
			}),
			apiFetch<{ paletteColors: PaletteColor[] }>(
				`/vocabularies/${vocabularyId}/palette-colors`,
				{ accessToken: auth.session.access_token }
			)
		]);
		const nextButtonsByBoardId: Record<string, BoardButton[]> = {};
		await Promise.all(
			boardData.boards.map(async (board) => {
				const buttonData = await apiFetch<{ buttons: BoardButton[] }>(
					`/vocabularies/${vocabularyId}/boards/${board.id}/buttons`,
					{ accessToken: auth.session.access_token }
				);
				nextButtonsByBoardId[board.id] = buttonData.buttons;
			})
		);
		replaceEditorLiveFromServer(
			session,
			boardData.boards,
			nextButtonsByBoardId,
			paletteData.paletteColors
		);
	}

	async function submitChangeSet(status: 'applied' | 'suggested') {
		const mutations = pendingEditorMutations(session);
		if (submitting || mutations.length === 0) return;
		submitting = true;
		submitError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/change-sets`, {
				method: 'POST',
				accessToken: auth.session.access_token,
				body: JSON.stringify({ status, mutations })
			});
			if (status === 'applied') {
				acceptEditorBase(session);
			} else {
				discardEditorChanges(session);
				await reloadSuggestedChangeSets();
			}
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Failed to submit changes';
		} finally {
			submitting = false;
		}
	}

	function discard() {
		discardEditorChanges(session);
		submitError = null;
	}

	async function applySuggestedChangeSet(changeSetId: string) {
		if (suggestionActionId || isDirty) return;
		suggestionActionId = changeSetId;
		submitError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/change-sets/${changeSetId}/apply`, {
				method: 'POST',
				accessToken: auth.session.access_token
			});
			await reloadLiveBoardsAndButtons();
			await reloadSuggestedChangeSets();
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Failed to apply suggestion';
		} finally {
			suggestionActionId = null;
		}
	}

	async function deleteSuggestedChangeSet(changeSetId: string) {
		if (suggestionActionId) return;
		suggestionActionId = changeSetId;
		submitError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/change-sets/${changeSetId}`, {
				method: 'DELETE',
				accessToken: auth.session.access_token
			});
			await reloadSuggestedChangeSets();
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Failed to delete suggestion';
		} finally {
			suggestionActionId = null;
		}
	}
</script>

{#if suggestedChangeSets.length > 0}
	<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
		<p class="mb-2 text-sm font-medium text-slate-800">Suggested Change Sets</p>
		<ul class="space-y-2">
			{#each suggestedChangeSets as changeSet (changeSet.id)}
				<li
					class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
				>
					<p class="text-sm text-slate-600">
						{changeSet.mutations.length}
						{changeSet.mutations.length === 1 ? 'mutation' : 'mutations'}
					</p>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={suggestionActionId !== null || isDirty}
							onclick={() => deleteSuggestedChangeSet(changeSet.id)}
						>
							{suggestionActionId === changeSet.id ? 'Working…' : 'Delete'}
						</button>
						<button
							type="button"
							class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={suggestionActionId !== null || isDirty}
							onclick={() => applySuggestedChangeSet(changeSet.id)}
						>
							{suggestionActionId === changeSet.id ? 'Working…' : 'Apply'}
						</button>
					</div>
				</li>
			{/each}
		</ul>
		{#if isDirty}
			<p class="mt-2 text-xs text-slate-500">
				Submit or discard unsaved changes before applying a suggestion.
			</p>
		{/if}
		{#if submitError && !isDirty}
			<p class="mt-2 text-sm text-red-700">{submitError}</p>
		{/if}
	</div>
{/if}

{#if isDirty}
	<div
		class="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3"
	>
		<p class="text-sm font-medium text-amber-900">Unsaved changes</p>
		<div class="flex flex-wrap items-center gap-2">
			{#if submitError}
				<p class="text-sm text-red-700">{submitError}</p>
			{/if}
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={submitting}
				onclick={discard}
			>
				Discard
			</button>
			<button
				type="button"
				class="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={submitting}
				onclick={() => submitChangeSet('suggested')}
			>
				{submitting ? 'Saving…' : 'Submit as suggestion'}
			</button>
			<button
				type="button"
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={submitting}
				onclick={() => submitChangeSet('applied')}
			>
				{submitting ? 'Saving…' : 'Submit'}
			</button>
		</div>
	</div>
{/if}
