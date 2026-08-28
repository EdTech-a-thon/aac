<script lang="ts">
	import { page } from '$app/state';
	import BoardWorkspace from '$lib/components/BoardWorkspace.svelte';
	import { readAuth } from '$lib/auth';
	import {
		loadSharedVocabulary,
		sharedVocabularySource,
		type SharedVocabulary,
		type VocabularySource
	} from '$lib/vocabularySource';
	import {
		applyEditorDraft,
		editorDraftState,
		getVocabularyEditorSession,
		isEditorDirty,
		subscribeEditorRevision
	} from '$lib/vocabularyEditorSession';
	import {
		browserDraftStorage,
		clearVisitorDraft,
		readVisitorDraft,
		writeVisitorDraft,
		type VisitorDraft
	} from '$lib/visitorDraft';

	const token = $derived(page.params.token ?? '');

	let shared = $state<SharedVocabulary['share'] | null>(null);
	let source = $state<VocabularySource | null>(null);
	let loading = $state(true);
	let unavailable = $state(false);

	// A kept draft is offered back, never silently reapplied — the Visitor
	// should be able to start again from what the link currently shows.
	let keptDraft = $state<VisitorDraft | null>(null);
	let draftSettled = $state(true);
	let savedAt = $state<string | null>(null);

	let revision = $state(0);
	$effect(() =>
		subscribeEditorRevision(() => {
			revision += 1;
		})
	);

	const signedIn = $derived(readAuth() != null);

	// A Board Share Link is named by its Board; a Vocabulary link by the Vocabulary.
	const title = $derived(
		shared ? (shared.board ? shared.board.displayName : shared.vocabulary.displayName) : ''
	);

	$effect(() => {
		const current = token;
		let cancelled = false;
		loading = true;
		unavailable = false;
		savedAt = null;

		const storage = browserDraftStorage();
		keptDraft = storage ? readVisitorDraft(storage, current) : null;
		draftSettled = keptDraft === null;

		(async () => {
			try {
				const payload = await loadSharedVocabulary(current);
				if (cancelled) return;
				shared = payload.share;
				source = sharedVocabularySource(payload.content);
			} catch {
				if (cancelled) return;
				// Revoked, deleted, or never real — all the same from out here.
				unavailable = true;
				shared = null;
				source = null;
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	// Keep the draft current, but never before the Visitor has said what to do
	// with the one they already had — that would overwrite it with the source.
	$effect(() => {
		revision;
		const currentShared = shared;
		if (!currentShared || !draftSettled) return;
		const storage = browserDraftStorage();
		if (!storage) return;
		const session = getVocabularyEditorSession(currentShared.vocabulary.id);
		if (!session.hydrated) return;
		if (!isEditorDirty(session)) return;
		savedAt = writeVisitorDraft(storage, token, editorDraftState(session)).savedAt;
	});

	function keepDraft() {
		if (!shared || !keptDraft) return;
		applyEditorDraft(getVocabularyEditorSession(shared.vocabulary.id), keptDraft.state);
		savedAt = keptDraft.savedAt;
		keptDraft = null;
		draftSettled = true;
	}

	function startOver() {
		const storage = browserDraftStorage();
		if (storage) clearVisitorDraft(storage, token);
		keptDraft = null;
		draftSettled = true;
		savedAt = null;
	}
</script>

<svelte:head>
	<title>{title || 'Shared'}</title>
</svelte:head>

<div class="flex h-screen min-h-0 flex-col bg-slate-50">
	{#if loading}
		<p class="m-auto text-sm text-slate-500">Opening…</p>
	{:else if unavailable}
		<div class="m-auto max-w-md px-6 text-center">
			<h1 class="text-lg font-semibold text-slate-800">This link isn't available</h1>
			<p class="mt-2 text-sm text-slate-600">
				It may have been turned off by the person who shared it. Ask them for a new link.
			</p>
		</div>
	{:else if shared && source}
		<header
			class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3"
		>
			<div class="min-w-0">
				<h1 class="truncate text-base font-semibold text-slate-800">{title}</h1>
				<p class="text-sm text-slate-500">
					{shared.board ? 'A board shared with you' : 'A vocabulary shared with you'} — changes
					you make stay in this browser.
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if savedAt}
					<span class="text-sm text-slate-500">Your changes are kept on this device</span>
					<button
						type="button"
						class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
						onclick={startOver}
					>
						Discard
					</button>
				{/if}
				{#if signedIn}
					<a
						class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						href="/vocabularies"
					>
						Your vocabularies
					</a>
				{/if}
			</div>
		</header>

		{#if keptDraft && !draftSettled}
			<div
				class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2"
			>
				<p class="text-sm text-amber-900">
					You have unsaved changes to this from a previous visit.
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						class="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
						onclick={keepDraft}
					>
						Keep my changes
					</button>
					<button
						type="button"
						class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
						onclick={startOver}
					>
						Start over
					</button>
				</div>
			</div>
		{/if}

		<div class="min-h-0 flex-1">
			<BoardWorkspace vocabularyId={shared.vocabulary.id} {source} />
		</div>
	{/if}
</div>
