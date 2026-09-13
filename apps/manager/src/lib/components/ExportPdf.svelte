<script lang="ts">
	import Menu from './Menu.svelte';
	import { pdfBoards } from '$lib/boardPdf';
	import type { Board, BoardButton, SnippetInclusion } from '$lib/types';

	let { boards, buttonsByBoardId, inclusions, palette, selectedBoard, vocabularyName, disabled = false }: {
		boards: Board[];
		buttonsByBoardId: Record<string, BoardButton[]>;
		inclusions: SnippetInclusion[];
		palette: Record<string, string>;
		selectedBoard: Board;
		vocabularyName: string;
		disabled?: boolean;
	} = $props();
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function exportPdf(allBoards: boolean) {
		if (busy || disabled) return;
		busy = true;
		error = null;
		try {
			const pages = pdfBoards(boards, buttonsByBoardId, inclusions, palette, allBoards ? undefined : selectedBoard.id);
			const name = allBoards ? vocabularyName : selectedBoard.displayName;
			const { downloadBoardPdf } = await import('$lib/boardPdfBrowser');
			await downloadBoardPdf(pages, name);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not export the PDF. Please try again.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex max-w-full flex-col gap-1">
	<Menu>
		{#snippet trigger({ toggle })}
			<button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50" disabled={disabled || busy} onclick={toggle}>
				{busy ? 'Creating PDF…' : 'Export PDF'}
			</button>
		{/snippet}
		{#snippet children({ close })}
			<button type="button" class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onclick={() => { close(); void exportPdf(false); }}>Current {selectedBoard.kind === 'snippet' ? 'snippet' : 'board'}</button>
			<button type="button" class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={!boards.some((board) => board.kind !== 'snippet')} onclick={() => { close(); void exportPdf(true); }}>All boards in vocabulary</button>
			<p class="max-w-64 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">One board per page. Pictures and labels only. Includes current edits.</p>
		{/snippet}
	</Menu>
	{#if busy}<span class="sr-only" role="status">Creating PDF…</span>{/if}
	{#if error}<p class="max-w-64 text-xs text-red-700" role="alert">{error}</p>{/if}
</div>
