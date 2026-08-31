<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BoardWorkspace from '$lib/components/BoardWorkspace.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import VisitorSignIn from '$lib/components/VisitorSignIn.svelte';
	import { readAuth } from '$lib/auth';
	import {
		copyPublication,
		loadPublication,
		reportPublication,
		setEndorsement,
		sharedVocabularySource,
		type GalleryPublication,
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

	const slug = $derived(page.params.slug ?? '');

	let published = $state<GalleryPublication['publication'] | null>(null);
	let source = $state<VocabularySource | null>(null);
	let loading = $state(true);
	let unavailable = $state(false);

	// A Publication Version is frozen, so its identifier names the content the
	// canvas holds and never has to be reconciled with a live Vocabulary.
	const canvasId = $derived(published ? `publication:${published.versionId}` : '');
	// A draft belongs to this Publication, the way a Visitor's draft belongs to
	// one Share Link.
	const draftToken = $derived(`publication:${slug}`);

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
	// What the visitor was trying to do when they were asked to sign in. Both
	// Endorse and Save a copy need an account, and resuming the wrong one would
	// copy a Vocabulary somebody only meant to endorse.
	let pendingIntent = $state<'copy' | 'endorse' | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	let discardOpen = $state(false);
	let discarding = $state(false);

	let endorsing = $state(false);
	let reportOpen = $state(false);
	let reportReason = $state('');
	let reporting = $state(false);
	let reportError = $state<string | null>(null);
	let reported = $state(false);

	const hasLocalEdits = $derived.by(() => {
		revision;
		if (!published) return false;
		if (savedAt) return true;
		const session = getVocabularyEditorSession(canvasId);
		return session.hydrated && isEditorDirty(session);
	});

	const gridRange = $derived.by(() => {
		if (!published || published.figures.boardCount === 0) return '';
		const smallest = `${published.figures.minColumns}×${published.figures.minRows}`;
		const largest = `${published.figures.maxColumns}×${published.figures.maxRows}`;
		return smallest === largest ? smallest : `${smallest} – ${largest}`;
	});

	async function open(current: string) {
		loading = true;
		unavailable = false;
		savedAt = null;
		reported = false;

		const storage = browserDraftStorage();
		keptDraft = storage ? readVisitorDraft(storage, `publication:${current}`) : null;
		draftSettled = keptDraft === null;

		try {
			const payload = await loadPublication(current, readAuth()?.session.access_token);
			published = payload.publication;
			source = sharedVocabularySource(payload.content);
		} catch {
			// Withdrawn, never published, or never real — all the same out here.
			unavailable = true;
			published = null;
			source = null;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const current = slug;
		let cancelled = false;
		void (async () => {
			await open(current);
			if (cancelled) return;
		})();
		return () => {
			cancelled = true;
		};
	});

	// Keep the draft current, but never before the Visitor has said what to do
	// with the one they already had.
	$effect(() => {
		revision;
		if (!published || !draftSettled) return;
		const storage = browserDraftStorage();
		if (!storage) return;
		const session = getVocabularyEditorSession(canvasId);
		if (!session.hydrated || !isEditorDirty(session)) return;
		savedAt = writeVisitorDraft(storage, draftToken, editorDraftState(session)).savedAt;
	});

	function keepDraft() {
		if (!keptDraft) return;
		applyEditorDraft(getVocabularyEditorSession(canvasId), keptDraft.state);
		savedAt = keptDraft.savedAt;
		keptDraft = null;
		draftSettled = true;
	}

	function dropKeptDraft() {
		const storage = browserDraftStorage();
		if (storage) clearVisitorDraft(storage, draftToken);
		keptDraft = null;
		draftSettled = true;
		savedAt = null;
	}

	/**
	 * Throw away every local edit. Unlike a Share Link, what comes back is this
	 * Publication Version — it is frozen, so there is nothing newer to catch up
	 * with. The edits only ever lived in this browser.
	 */
	async function discardMyChanges() {
		if (!published || discarding) return;
		discarding = true;
		try {
			const storage = browserDraftStorage();
			if (storage) clearVisitorDraft(storage, draftToken);

			const payload = await loadPublication(slug, readAuth()?.session.access_token);
			published = payload.publication;
			source = sharedVocabularySource(payload.content);
			replaceEditorLiveFromServer(
				getVocabularyEditorSession(`publication:${payload.publication.versionId}`),
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
			discardOpen = false;
			unavailable = true;
			published = null;
			source = null;
		} finally {
			discarding = false;
		}
	}

	async function keepThis() {
		if (!published || saving) return;
		const auth = readAuth();
		if (!auth) {
			pendingIntent = 'copy';
			signInOpen = true;
			return;
		}
		saving = true;
		saveError = null;
		try {
			const session = getVocabularyEditorSession(canvasId);
			const saved = await copyPublication(slug, auth.session.access_token, {
				name: published.title,
				snapshot: session.hydrated ? visibleVocabularySnapshot(session) : undefined
			});
			// It is theirs now, so the draft has nothing left to protect.
			const storage = browserDraftStorage();
			if (storage) clearVisitorDraft(storage, draftToken);
			await goto(`/vocabularies/${saved.vocabulary.id}`);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Could not save a copy of this';
		} finally {
			saving = false;
		}
	}

	function onauthed() {
		signInOpen = false;
		authTick += 1;
		const intent = pendingIntent;
		pendingIntent = null;
		if (intent === 'endorse') {
			void toggleEndorsement();
		} else if (intent === 'copy') {
			void keepThis();
		}
	}

	async function toggleEndorsement() {
		if (!published || endorsing) return;
		const auth = readAuth();
		if (!auth) {
			pendingIntent = 'endorse';
			signInOpen = true;
			return;
		}
		endorsing = true;
		saveError = null;
		try {
			const result = await setEndorsement(slug, !published.youEndorsed, auth.session.access_token);
			published = {
				...published,
				youEndorsed: result.standing,
				endorsementCount: result.count
			};
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Could not endorse this';
		} finally {
			endorsing = false;
		}
	}

	async function submitReport() {
		if (reporting || !reportReason.trim()) return;
		reporting = true;
		reportError = null;
		try {
			await reportPublication(slug, reportReason, readAuth()?.session.access_token);
			reported = true;
			reportOpen = false;
			reportReason = '';
		} catch (err) {
			reportError = err instanceof Error ? err.message : 'Could not send that report';
		} finally {
			reporting = false;
		}
	}
</script>

<svelte:head>
	<title>{published?.title ?? 'Gallery'}</title>
</svelte:head>

<div class="flex h-screen min-h-0 flex-col bg-slate-50">
	{#if loading}
		<p class="m-auto text-sm text-slate-500">Opening…</p>
	{:else if unavailable}
		<div class="m-auto max-w-md px-6 text-center">
			<h1 class="text-lg font-semibold text-slate-800">This isn't available</h1>
			<p class="mt-2 text-sm text-slate-600">
				It may have been taken off the Gallery by the person who shared it.
			</p>
			<a class="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline" href="/gallery">
				Back to the Gallery
			</a>
		</div>
	{:else if published && source}
		<header
			class="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3"
		>
			<div class="min-w-0">
				<a class="text-xs font-medium text-blue-700 hover:underline" href="/gallery">← Gallery</a>
				<h1 class="truncate text-base font-semibold text-slate-800">{published.title}</h1>
				<p class="text-sm text-slate-600">{published.description}</p>
				<p class="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
					{#if published.attribution}<span>{published.attribution}</span>{/if}
					<span title="Boards">▦ {published.figures.boardCount}</span>
					<span title="Buttons">◻ {published.figures.buttonCount}</span>
					{#if gridRange}<span title="Grid size">⊞ {gridRange}</span>{/if}
					<span>Changes you make here stay in this browser.</span>
				</p>
			</div>
			<div class="flex shrink-0 flex-wrap items-center gap-2">
				<button
					type="button"
					class="rounded-lg border px-3 py-1.5 text-sm font-medium transition {published.youEndorsed
						? 'border-blue-300 bg-blue-50 text-blue-700'
						: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}"
					disabled={endorsing}
					onclick={toggleEndorsement}
				>
					{published.youEndorsed ? 'Endorsed' : 'Endorse'} · {published.endorsementCount}
				</button>
				<button
					type="button"
					class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={saving}
					onclick={keepThis}
				>
					{saving ? 'Saving…' : signedIn ? 'Save a copy' : 'Sign in to save a copy'}
				</button>
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
						onclick={dropKeptDraft}
					>
						Start over
					</button>
				</div>
			</div>
		{/if}

		<div class="min-h-0 flex-1">
			<BoardWorkspace vocabularyId={canvasId} {source} />
		</div>

		<footer class="shrink-0 border-t border-slate-200 bg-white px-4 py-2 text-right">
			{#if reported}
				<span class="text-xs text-slate-500">Thanks — we'll take a look.</span>
			{:else}
				<button
					type="button"
					class="text-xs text-slate-500 underline hover:text-slate-700"
					onclick={() => (reportOpen = true)}
				>
					Report this
				</button>
			{/if}
		</footer>
	{/if}
</div>

<Modal
	bind:open={signInOpen}
	title={pendingIntent === 'endorse' ? 'Sign in to endorse this' : 'Save this to your account'}
	onClose={() => (pendingIntent = null)}
>
	<VisitorSignIn {onauthed} />
</Modal>

<Modal bind:open={discardOpen} title="Discard your changes?">
	<div class="space-y-3">
		<p class="text-sm text-slate-600">
			Everything you have changed here will go, and this will look the way it was published. Your
			changes were only ever in this browser, so there is no way to get them back.
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

<Modal bind:open={reportOpen} title="Report this vocabulary">
	<form
		class="space-y-3"
		onsubmit={(event) => {
			event.preventDefault();
			void submitReport();
		}}
	>
		<label class="block space-y-1">
			<span class="text-sm font-medium text-slate-700">What is wrong with it?</span>
			<textarea
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				rows="3"
				placeholder="Tell us what you noticed — a symbol set that was licensed, a photo of someone, anything else."
				bind:value={reportReason}
			></textarea>
		</label>
		{#if reportError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{reportError}</p>
		{/if}
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				onclick={() => (reportOpen = false)}
			>
				Cancel
			</button>
			<button
				class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
				type="submit"
				disabled={reporting || !reportReason.trim()}
			>
				{reporting ? 'Sending…' : 'Send report'}
			</button>
		</div>
	</form>
</Modal>
