<script lang="ts">
	import { page } from '$app/state';

	const vocabularyId = $derived(page.params.id ?? '');
</script>

<div class="flex h-full flex-col gap-4 overflow-auto p-6">
	<div>
		<a
			href={`/vocabularies/${vocabularyId}`}
			class="text-sm font-medium text-blue-700 hover:underline"
		>
			← Back to boards
		</a>
		<h1 class="mt-3 text-2xl font-semibold text-slate-900">Settings</h1>
		<p class="mt-1 text-sm text-slate-600">
			Vocabulary settings. Palette editing will live here next.
		</p>
	</div>
</div>
