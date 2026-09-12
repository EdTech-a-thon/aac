<script lang="ts">
	let { url, busy, scope, onCreate, onRevoke }: {
		url: string;
		busy: boolean;
		scope: 'board' | 'vocabulary';
		onCreate: () => void;
		onRevoke: () => void;
	} = $props();
	let copied = $state(false);
	let error = $state('');
	let confirmRevoke = $state(false);
	let nativeShare = $state(false);
	$effect(() => { nativeShare = typeof navigator.share === 'function'; });
	$effect(() => { url; copied = false; error = ''; confirmRevoke = false; });

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			error = '';
		} catch { error = 'Could not copy automatically. Select the link below and copy it manually.'; }
	}
	async function shareLink() {
		try { await navigator.share({ url }); }
		catch (err) {
			if (!(err instanceof Error && err.name === 'AbortError')) error = 'Could not open sharing. Try Copy link instead.';
		}
	}
</script>

<div class="space-y-4">
	<div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
		<h3 class="font-semibold text-slate-900">{scope === 'board' ? 'Only this board' : 'All boards in this vocabulary'}</h3>
		<p class="mt-1 text-sm leading-relaxed text-slate-600">Anyone with this link can read and make their own copy, without changing your original. No account is needed to read.</p>
		<p class="mt-2 text-sm text-slate-600">The link shows applied changes, not pending edits. It does not publish anything to the Gallery.</p>
		{#if scope === 'board'}<p class="mt-2 text-sm text-slate-600">Other boards stay private. Buttons linking to them will not open.</p>{/if}
	</div>
	{#if url}
		<p class="text-sm font-medium text-emerald-700">Link sharing is on</p>
		<label class="block space-y-1 text-sm font-medium text-slate-700">
			Share link
			<input class="w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" readonly value={url} onclick={(event) => event.currentTarget.select()} />
		</label>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onclick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
			{#if nativeShare}<button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" onclick={shareLink}>Share via…</button>{/if}
			<a class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" href={url} target="_blank" rel="noreferrer">Open link ↗</a>
		</div>
		{#if confirmRevoke}
			<div class="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
				<p class="text-sm text-red-900">Turn off this link? Everyone using it will lose access. Sharing again creates a different link.</p>
				<div class="flex flex-wrap gap-2">
					<button type="button" class="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onclick={onRevoke}>{busy ? 'Turning off…' : 'Turn off link'}</button>
					<button type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={busy} onclick={() => confirmRevoke = false}>Cancel</button>
				</div>
			</div>
		{:else}
			<button type="button" class="text-sm font-medium text-red-700 underline underline-offset-4" disabled={busy} onclick={() => confirmRevoke = true}>Turn off link…</button>
		{/if}
	{:else}
		<p class="text-sm text-slate-500">Link sharing is off.</p>
		<button type="button" class="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={busy} onclick={onCreate}>{busy ? 'Please wait…' : 'Create share link'}</button>
	{/if}
	<p class="sr-only" role="status">{copied ? 'Link copied to clipboard' : ''}</p>
	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
</div>
