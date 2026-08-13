<script lang="ts">
	import Menu from '$lib/components/Menu.svelte';
	import { apiFetch, type AuthState } from '$lib/auth';
	import { normalizeSuggestedChangeSets } from '$lib/describeChangeSetMutations';
	import {
		acceptEditorBase,
		discardEditorChanges,
		getVocabularyEditorSession,
		isEditorDirty,
		pendingEditorMutations,
		persistEditorSession,
		subscribeEditorRevision,
		type SuggestedChangeSet
	} from '$lib/vocabularyEditorSession';

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

	$effect(() => subscribeEditorRevision(() => {
		revision += 1;
	}));

	const session = $derived(getVocabularyEditorSession(vocabularyId));
	const pendingCount = $derived.by(() => {
		revision;
		return pendingEditorMutations(session).length;
	});
	const isDirty = $derived.by(() => {
		revision;
		return isEditorDirty(session);
	});

	async function reloadSuggestedChangeSets() {
		const data = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
			`/vocabularies/${vocabularyId}/change-sets?status=suggested`,
			{ accessToken: auth.session.access_token }
		);
		persistEditorSession(session, {
			suggestedChangeSets: normalizeSuggestedChangeSets(data.changeSets)
		});
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

	function changeLabel(count: number) {
		return count === 1 ? 'unsaved change' : 'unsaved changes';
	}
</script>

{#if isDirty}
	<div class="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
		<div
			class="pointer-events-auto flex w-max max-w-full flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg"
		>
			<p class="text-sm font-medium text-amber-950">
				{pendingCount}
				{changeLabel(pendingCount)}
			</p>
			<div class="relative flex items-stretch">
				<button
					type="button"
					class="rounded-l-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={submitting}
					onclick={() => submitChangeSet('applied')}
				>
					{submitting ? 'Saving…' : 'Save'}
				</button>
				<Menu align="right" drop="up">
					{#snippet trigger({ toggle, open })}
						<button
							type="button"
							class="rounded-r-lg border-l border-amber-500 bg-amber-600 px-2 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
							aria-label="Save options"
							aria-expanded={open}
							disabled={submitting}
							onclick={(event) => {
								event.stopPropagation();
								toggle();
							}}
						>
							▾
						</button>
					{/snippet}
					{#snippet children({ close })}
						<button
							type="button"
							class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
							onclick={() => {
								close();
								submitChangeSet('applied');
							}}
						>
							Save changes
						</button>
						<button
							type="button"
							class="block w-full px-3 py-2 text-left text-sm text-emerald-800 transition hover:bg-emerald-50"
							onclick={() => {
								close();
								submitChangeSet('suggested');
							}}
						>
							Suggest changes
						</button>
						<button
							type="button"
							class="block w-full px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
							onclick={() => {
								close();
								discard();
							}}
						>
							Discard changes
						</button>
					{/snippet}
				</Menu>
			</div>
			{#if submitError}
				<p class="text-sm text-red-700">{submitError}</p>
			{/if}
		</div>
	</div>
{/if}
