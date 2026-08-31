<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BoardWorkspace from '$lib/components/BoardWorkspace.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import VisitorSignIn from '$lib/components/VisitorSignIn.svelte';
	import { readAuth } from '$lib/auth';
	import type { Vocabulary } from '$lib/types';
	import {
		loadSharedVocabulary,
		listOwnVocabularies,
		saveSharedBoard,
		saveSharedVocabulary,
		sharedVocabularySource,
		type SharedVocabulary,
		type VocabularySource
	} from '$lib/vocabularySource';
	import {
		applyEditorDraft,
		editorDraftState,
		getVocabularyEditorSession,
		isEditorDirty,
		replaceEditorLiveFromServer,
		subscribeEditorRevision,
		visibleVocabularySnapshot
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

	let authTick = $state(0);
	const signedIn = $derived.by(() => {
		authTick;
		return readAuth() != null;
	});

	let signInOpen = $state(false);
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	let discardOpen = $state(false);
	let discarding = $state(false);

	// Offer the discard only when there is something to throw away. A draft may
	// be kept on this device, or the Visitor may simply have unsaved edits in
	// front of them — a browser that refuses storage still gets the control.
	const hasLocalEdits = $derived.by(() => {
		revision;
		const currentShared = shared;
		if (!currentShared) return false;
		if (savedAt) return true;
		const session = getVocabularyEditorSession(currentShared.vocabulary.id);
		return session.hydrated && isEditorDirty(session);
	});

	// Keeping a shared Board asks where it should go.
	let destinationOpen = $state(false);
	let destinations = $state<Vocabulary[]>([]);
	let destinationId = $state('');
	let destinationName = $state('');

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

	async function keepThis() {
		const currentShared = shared;
		if (!currentShared || saving) return;
		const auth = readAuth();
		if (!auth) {
			signInOpen = true;
			return;
		}
		if (currentShared.board) {
			destinationName = currentShared.board.name;
			destinationId = '';
			destinationOpen = true;
			saveError = null;
			try {
				destinations = await listOwnVocabularies(auth.session.access_token);
			} catch {
				destinations = [];
			}
			return;
		}
		saving = true;
		saveError = null;
		try {
			const session = getVocabularyEditorSession(currentShared.vocabulary.id);
			const saved = await saveSharedVocabulary(
				token,
				auth.session.access_token,
				currentShared.vocabulary.name,
				visibleVocabularySnapshot(session)
			);
			// It is theirs now, so the draft has nothing left to protect.
			const storage = browserDraftStorage();
			if (storage) clearVisitorDraft(storage, token);
			await goto(`/vocabularies/${saved.vocabulary.id}`);
		} catch (err) {
			// A link revoked while they worked must not cost them their edits.
			saveError = err instanceof Error ? err.message : 'Could not save this';
		} finally {
			saving = false;
		}
	}

	async function keepBoard() {
		const currentShared = shared;
		const auth = readAuth();
		if (!currentShared || !auth || saving) return;
		saving = true;
		saveError = null;
		try {
			const session = getVocabularyEditorSession(currentShared.vocabulary.id);
			const saved = await saveSharedBoard(token, auth.session.access_token, {
				destinationVocabularyId: destinationId || undefined,
				name: destinationName,
				snapshot: visibleVocabularySnapshot(session)
			});
			const storage = browserDraftStorage();
			if (storage) clearVisitorDraft(storage, token);
			destinationOpen = false;
			await goto(`/vocabularies/${saved.vocabulary?.id ?? saved.vocabularyId}`);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Could not keep this board';
		} finally {
			saving = false;
		}
	}

	function onauthed() {
		signInOpen = false;
		authTick += 1;
		void keepThis();
	}

	/**
	 * Declining a draft kept from a previous visit. The session was hydrated
	 * from the link on open, so there is nothing in front of the Visitor to
	 * restore — only the stored draft to drop.
	 */
	function startOver() {
		const storage = browserDraftStorage();
		if (storage) clearVisitorDraft(storage, token);
		keptDraft = null;
		draftSettled = true;
		savedAt = null;
	}

	/**
	 * Throw away every local edit and go back to what the link shows. A Share
	 * Link is live (ADR 0010), so this re-reads the source rather than rewinding
	 * to whatever it said when the Visitor arrived — any Change Set applied
	 * since then is part of what they get back.
	 *
	 * Unrecoverable by definition: these edits only ever lived in this browser.
	 */
	async function discardMyChanges() {
		const currentShared = shared;
		if (!currentShared || discarding) return;
		discarding = true;
		saveError = null;
		try {
			const storage = browserDraftStorage();
			if (storage) clearVisitorDraft(storage, token);

			const payload = await loadSharedVocabulary(token);
			shared = payload.share;
			source = sharedVocabularySource(payload.content);
			replaceEditorLiveFromServer(
				getVocabularyEditorSession(payload.share.vocabulary.id),
				payload.content.boards,
				payload.content.buttonsByBoardId,
				payload.content.paletteColors,
				payload.content.snippetInclusions
			);

			keptDraft = null;
			draftSettled = true;
			savedAt = null;
			discardOpen = false;
		} catch {
			// The link went away while they were deciding. Their edits are already
			// gone, so say what happened rather than pretending it worked.
			discardOpen = false;
			unavailable = true;
			shared = null;
			source = null;
		} finally {
			discarding = false;
		}
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
				{#if !shared.board}
					<button
						type="button"
						class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
						disabled={saving}
						onclick={keepThis}
					>
						{saving ? 'Saving…' : signedIn ? 'Save to my account' : 'Sign in to save'}
					</button>
				{/if}
				{#if savedAt}
					<span class="text-sm text-slate-500">Your changes are kept on this device</span>
				{/if}
				{#if hasLocalEdits}
					<button
						type="button"
						class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
						onclick={() => (discardOpen = true)}
					>
						Discard my changes
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

		{#if saveError}
			<p class="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
				{saveError}
			</p>
		{/if}

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

<Modal bind:open={signInOpen} title="Save this to your account">
	<VisitorSignIn {onauthed} />
</Modal>

<Modal bind:open={discardOpen} title="Discard your changes?">
	<div class="space-y-3">
		<p class="text-sm text-slate-600">
			Everything you have changed here will go, and this will look the way it does for the person
			who shared it. Your changes were only ever in this browser, so there is no way to get them
			back.
		</p>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				disabled={discarding}
				onclick={() => (discardOpen = false)}
			>
				Keep editing
			</button>
			<button
				type="button"
				class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={discarding}
				onclick={discardMyChanges}
			>
				{discarding ? 'Discarding…' : 'Discard my changes'}
			</button>
		</div>
	</div>
</Modal>

<Modal bind:open={destinationOpen} title="Keep this board">
	<form
		class="space-y-3"
		onsubmit={(event) => {
			event.preventDefault();
			void keepBoard();
		}}
	>
		<label class="block space-y-1">
			<span class="text-sm font-medium text-slate-700">Name</span>
			<input
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="text"
				bind:value={destinationName}
			/>
		</label>
		<label class="block space-y-1">
			<span class="text-sm font-medium text-slate-700">Where should it go?</span>
			<select
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				bind:value={destinationId}
			>
				<option value="">A new vocabulary</option>
				{#each destinations as candidate (candidate.id)}
					<option value={candidate.id}>{candidate.displayName}</option>
				{/each}
			</select>
		</label>
		<p class="text-sm text-slate-500">
			{destinationId
				? 'Buttons that open another board will need new actions, and colours become fixed to their current shade.'
				: 'Its colours come across as a palette you can keep editing.'}
		</p>
		<div class="flex justify-end">
			<button
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
				type="submit"
				disabled={saving}
			>
				{saving ? 'Saving…' : 'Keep it'}
			</button>
		</div>
	</form>
</Modal>
