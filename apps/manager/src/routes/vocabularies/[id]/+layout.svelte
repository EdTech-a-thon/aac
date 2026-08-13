<script lang="ts">
	import { page } from '$app/state';
	import PendingChangeSetBar from '$lib/components/PendingChangeSetBar.svelte';
	import { getDashboard } from '$lib/dashboard';

	let { children } = $props();

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');
</script>

<div class="flex h-full min-h-0 flex-1 flex-col">
	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
	{#if vocabularyId && dashboard.auth}
		<PendingChangeSetBar vocabularyId={vocabularyId} auth={dashboard.auth} />
	{/if}
</div>
