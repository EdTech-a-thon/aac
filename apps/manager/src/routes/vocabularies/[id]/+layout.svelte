<script lang="ts">
	import { page } from '$app/state';
	import UnsavedChangesBar from '$lib/components/UnsavedChangesBar.svelte';
	import { getDashboard } from '$lib/dashboard';

	let { children } = $props();

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');
	const onSuggestionPage = $derived(page.url.pathname.includes('/suggestions'));
</script>

<div class="relative flex h-full min-h-0 flex-1 flex-col">
	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
	{#if vocabularyId && dashboard.auth && !onSuggestionPage}
		<UnsavedChangesBar vocabularyId={vocabularyId} auth={dashboard.auth} />
	{/if}
</div>
