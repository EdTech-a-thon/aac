<script lang="ts">
	import ButtonFace from './ButtonFace.svelte';
	import { symbolUrl } from '$lib/auth';
	import { readingButtons } from '$lib/boardReading';
	import { resolveButtonHex } from '$lib/buttonFace';
	import { contrastingTextColor } from '$lib/fitzgeraldColors';
	import type { Board, BoardButton, SnippetInclusion } from '$lib/types';

	let { board, boards, buttonsByBoardId, inclusions, paletteById, onOpenBoard }: {
		board: Board;
		boards: Board[];
		buttonsByBoardId: Record<string, BoardButton[]>;
		inclusions: SnippetInclusion[];
		paletteById: Record<string, string>;
		onOpenBoard: (id: string) => void;
	} = $props();
	const cells = $derived(readingButtons(board.id, boards, buttonsByBoardId, inclusions));
</script>

<section class="min-h-0 min-w-0 overflow-auto p-4 sm:p-6" aria-label="Read board">
	<div class="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-2">
		<p class="text-sm text-slate-600">Read without changing anything. Linked buttons open other available boards.</p>
		<span class="text-xs text-slate-500">{board.width} columns × {board.height} rows</span>
	</div>
	<div class="mx-auto max-w-5xl overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
		<div class="grid gap-2" style={`grid-template-columns: repeat(${board.width}, minmax(72px, 1fr));`}>
			{#each Array.from({ length: board.height * board.width }, (_, index) => index) as index (index)}
				{@const button = cells.get(`${Math.floor(index / board.width)}:${index % board.width}`)}
				{@const action = button?.action}
				{@const target = action?.kind === 'open_board' && boards.some((b) => b.id === action.board_id && b.kind !== 'snippet') ? action.board_id : null}
				{#if button}
					{@const hex = resolveButtonHex(button, paletteById)}
					{#if target}
						<button type="button" class="relative aspect-square min-h-18 overflow-hidden rounded-xl border border-slate-300 shadow-sm hover:ring-2 hover:ring-blue-500" style={`background:${hex};color:${contrastingTextColor(hex)}`} aria-label={`Open board: ${button.label || 'Untitled button'}`} onclick={() => onOpenBoard(target)}>
							<ButtonFace label={button.label} symbolSrc={button.symbol_digest ? symbolUrl(button.symbol_digest) : null} />
							<span class="absolute right-1 bottom-0 text-xs" aria-hidden="true">↗</span>
						</button>
					{:else}
						<div class="relative aspect-square min-h-18 overflow-hidden rounded-xl border border-slate-300" style={`background:${hex};color:${contrastingTextColor(hex)}`}>
							<ButtonFace label={button.label} symbolSrc={button.symbol_digest ? symbolUrl(button.symbol_digest) : null} />
						</div>
					{/if}
				{:else}
					<div class="aspect-square min-h-18 rounded-xl bg-slate-100" aria-hidden="true"></div>
				{/if}
			{/each}
		</div>
	</div>
</section>
