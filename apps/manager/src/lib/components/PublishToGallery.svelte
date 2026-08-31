<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { apiFetch, symbolUrl, type AuthState } from '$lib/auth';

	type ConsentText = { id: string; clause: string; wording: string };
	type Figures = {
		board_count: number;
		button_count: number;
		min_columns: number;
		min_rows: number;
		max_columns: number;
		max_rows: number;
	};
	type PublicationVersion = { id: string; seq: number; name: string; created_at: string };
	type PublicationState = {
		publication: {
			slug: string;
			published: boolean;
			drifted: boolean;
			copyCount: number;
			currentVersion: PublicationVersion | null;
		} | null;
		consentTexts: ConsentText[];
		preflight: {
			figures: Figures;
			symbolDigests: string[];
			problems: string[];
			unresolvedCopyActionCount: number;
		};
	};

	let { vocabularyId, auth }: { vocabularyId: string; auth: AuthState } = $props();

	let gallery = $state<PublicationState | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let open = $state(false);
	let attribution = $state('');
	let checked = $state<Record<string, boolean>>({});
	let publishing = $state(false);
	let publishError = $state<string | null>(null);

	let withdrawOpen = $state(false);
	let withdrawing = $state(false);

	// The order the three confirmations are always shown in: what you are
	// entitled to share, what happens to it, and who might be in it.
	const CLAUSE_ORDER = ['rights', 'free_to_copy', 'no_personal_content'];

	const consentTexts = $derived(
		[...(gallery?.consentTexts ?? [])].sort(
			(a, b) => CLAUSE_ORDER.indexOf(a.clause) - CLAUSE_ORDER.indexOf(b.clause)
		)
	);
	const problems = $derived(gallery?.preflight.problems ?? []);
	const figures = $derived(gallery?.preflight.figures ?? null);
	const symbolDigests = $derived(gallery?.preflight.symbolDigests ?? []);
	const alreadyPublished = $derived(gallery?.publication?.published === true);
	const allConfirmed = $derived(
		consentTexts.length === CLAUSE_ORDER.length && consentTexts.every((text) => checked[text.clause])
	);
	const canPublish = $derived(allConfirmed && problems.length === 0 && !publishing);

	const publicUrl = $derived(
		gallery?.publication
			? `${typeof location === 'undefined' ? '' : location.origin}/gallery/${gallery.publication.slug}`
			: ''
	);

	/** "4×3" when every Board matches, "2×2 – 8×6" when they do not. */
	const gridRange = $derived.by(() => {
		if (!figures || figures.board_count === 0) return '';
		const smallest = `${figures.min_columns}×${figures.min_rows}`;
		const largest = `${figures.max_columns}×${figures.max_rows}`;
		return smallest === largest ? smallest : `${smallest} – ${largest}`;
	});

	async function load() {
		loading = true;
		loadError = null;
		try {
			gallery = await apiFetch<PublicationState>(`/vocabularies/${vocabularyId}/publication`, {
				accessToken: auth.session.access_token
			});
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read publishing status';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (vocabularyId) void load();
	});

	function openPublish() {
		attribution = gallery?.publication?.currentVersion ? attribution : '';
		checked = {};
		publishError = null;
		open = true;
	}

	async function withdraw() {
		if (withdrawing) return;
		withdrawing = true;
		publishError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/publish`, {
				method: 'DELETE',
				accessToken: auth.session.access_token
			});
			withdrawOpen = false;
			await load();
		} catch (err) {
			publishError = err instanceof Error ? err.message : 'Could not take this off the Gallery';
		} finally {
			withdrawing = false;
		}
	}

	async function submit() {
		if (!canPublish || !gallery) return;
		publishing = true;
		publishError = null;
		try {
			await apiFetch(`/vocabularies/${vocabularyId}/publish`, {
				method: 'POST',
				accessToken: auth.session.access_token,
				body: JSON.stringify({
					attribution,
					confirmations: consentTexts.map((text) => ({
						clause: text.clause,
						consentTextId: text.id
					}))
				})
			});
			open = false;
			await load();
		} catch (err) {
			publishError = err instanceof Error ? err.message : 'Could not publish this Vocabulary';
		} finally {
			publishing = false;
		}
	}
</script>

<div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
	{#if loading}
		<p class="text-sm text-slate-500">Checking…</p>
	{:else if loadError}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
	{:else}
		{#if alreadyPublished && gallery?.publication}
			<p class="text-sm text-slate-700">
				This is on the Gallery for anyone to find and copy.
			</p>
			<p class="text-sm">
				<a class="font-medium text-blue-700 hover:underline" href={`/gallery/${gallery.publication.slug}`}>
					{publicUrl}
				</a>
			</p>
			<p class="text-sm text-slate-600">
				{gallery.publication.copyCount === 0
					? 'Nobody has copied it yet.'
					: gallery.publication.copyCount === 1
						? 'One person has kept a copy of this.'
						: `${gallery.publication.copyCount} people have kept a copy of this.`}
			</p>
			{#if gallery.publication.drifted}
				<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
					You have changed this since you published it. What the Gallery shows is frozen at the
					last version — publish an update when you want people to see these changes.
				</p>
			{/if}
		{:else}
			<p class="text-sm text-slate-700">
				Put this Vocabulary on the Gallery, where anyone can find it, try it, and keep a copy of
				their own. What you publish is frozen — editing this Vocabulary afterwards changes nothing
				there until you publish again.
			</p>
		{/if}

		{#if problems.length > 0}
			<ul class="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
				{#each problems as problem (problem)}
					<li>{problem}</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				disabled={problems.length > 0}
				onclick={openPublish}
			>
				{alreadyPublished ? 'Publish an update' : 'Publish to the Gallery…'}
			</button>
			{#if alreadyPublished}
				<button
					type="button"
					class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
					onclick={() => (withdrawOpen = true)}
				>
					Take it off the Gallery
				</button>
			{/if}
		</div>
	{/if}
</div>

<Modal bind:open title={alreadyPublished ? 'Publish an update' : 'Publish to the Gallery'}>
	<div class="space-y-4">
		{#if figures && figures.board_count > 0}
			<p class="text-sm text-slate-600">
				{figures.board_count}
				{figures.board_count === 1 ? 'board' : 'boards'}, {figures.button_count}
				{figures.button_count === 1 ? 'button' : 'buttons'}{gridRange ? `, ${gridRange}` : ''}.
			</p>
		{/if}

		{#if gallery && gallery.preflight.unresolvedCopyActionCount > 0}
			<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
				{gallery.preflight.unresolvedCopyActionCount}
				{gallery.preflight.unresolvedCopyActionCount === 1 ? 'button' : 'buttons'} copied from
				elsewhere still have no action. You can publish anyway, but they will do nothing for
				whoever copies this.
			</p>
		{/if}

		<div class="space-y-2">
			<p class="text-sm font-medium text-slate-700">
				Everything pictured here becomes public
			</p>
			{#if symbolDigests.length === 0}
				<p class="text-sm text-slate-500">This Vocabulary uses no images.</p>
			{:else}
				<p class="text-xs text-slate-500">
					Look before you publish: a symbol set you licensed, or a photo of someone, is easy to
					miss in a list of board names.
				</p>
				<div class="flex max-h-44 flex-wrap gap-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
					{#each symbolDigests as digest (digest)}
						<img
							class="h-12 w-12 rounded border border-slate-200 bg-white object-contain"
							src={symbolUrl(digest)}
							alt=""
						/>
					{/each}
				</div>
			{/if}
		</div>

		<label class="block space-y-1">
			<span class="text-sm font-medium text-slate-700">Credit this to (optional)</span>
			<input
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				type="text"
				placeholder="Your name, or your team's"
				bind:value={attribution}
			/>
		</label>

		<div class="space-y-2">
			{#each consentTexts as text (text.id)}
				<label class="flex items-start gap-2 text-sm text-slate-700">
					<input
						type="checkbox"
						class="mt-0.5"
						checked={checked[text.clause] ?? false}
						onchange={(event) => {
							checked = {
								...checked,
								[text.clause]: (event.currentTarget as HTMLInputElement).checked
							};
						}}
					/>
					<span>{text.wording}</span>
				</label>
			{/each}
		</div>

		{#if publishError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{publishError}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
				disabled={publishing}
				onclick={() => (open = false)}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				disabled={!canPublish}
				onclick={submit}
			>
				{publishing ? 'Publishing…' : 'Publish'}
			</button>
		</div>
	</div>
</Modal>

<Modal bind:open={withdrawOpen} title="Take this off the Gallery?">
	<div class="space-y-3">
		<p class="text-sm text-slate-600">
			Its page and its listing both stop working. Nothing is deleted — your endorsements and
			history are kept, and publishing it again picks up where this left off with the same link.
		</p>
		<p class="text-sm text-slate-600">
			Copies people have already made are theirs, and stay exactly as they are.
		</p>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
				disabled={withdrawing}
				onclick={() => (withdrawOpen = false)}
			>
				Leave it up
			</button>
			<button
				type="button"
				class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
				disabled={withdrawing}
				onclick={withdraw}
			>
				{withdrawing ? 'Removing…' : 'Take it off'}
			</button>
		</div>
	</div>
</Modal>
