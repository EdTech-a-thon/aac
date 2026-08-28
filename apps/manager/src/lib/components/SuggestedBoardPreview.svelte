<script lang="ts">
	import { columnLetter, rowNumber } from '$lib/boardCellRef';
	import ButtonFace from '$lib/components/ButtonFace.svelte';
	import { symbolUrl } from '$lib/auth';
	import { resolveButtonHex } from '$lib/buttonFace';
	import { contrastingTextColor } from '$lib/fitzgeraldColors';
	import type { PreviewButton, PreviewOverlay } from '$lib/groupSuggestedChanges';

	let {
		width,
		height,
		buttons = [],
		overlays = [],
		paletteById = {},
		deleted = false,
		created = false,
		markerId = 'preview'
	}: {
		width: number;
		height: number;
		buttons?: PreviewButton[];
		overlays?: PreviewOverlay[];
		paletteById?: Record<string, string>;
		deleted?: boolean;
		created?: boolean;
		markerId?: string;
	} = $props();

	const CELL = 36;
	const GAP = 3;
	const LABEL = 16;

	function cellLeft(col: number) {
		return col * (CELL + GAP);
	}
	function cellTop(row: number) {
		return row * (CELL + GAP);
	}
	function cellSpanSize(count: number) {
		return count * CELL + Math.max(0, count - 1) * GAP;
	}
	function cellCenter(row: number, col: number) {
		return {
			x: LABEL + cellLeft(col) + CELL / 2,
			y: LABEL + cellTop(row) + CELL / 2
		};
	}

	function resolveHex(button: PreviewButton) {
		return resolveButtonHex(button, paletteById);
	}

	const gridW = $derived(width * CELL + Math.max(0, width - 1) * GAP);
	const gridH = $derived(height * CELL + Math.max(0, height - 1) * GAP);
	const totalW = $derived(gridW + LABEL);
	const totalH = $derived(gridH + LABEL);

	const moveOverlays = $derived(
		overlays.filter((o): o is Extract<PreviewOverlay, { kind: 'move' }> => o.kind === 'move')
	);
</script>

<div
	class="relative inline-block overflow-visible rounded-lg border bg-white p-2 {deleted
		? 'border-red-300 opacity-80'
		: created
			? 'border-slate-400 border-dashed'
			: 'border-slate-200'}"
	style={`width: ${totalW + 16}px;`}
>
	<div class="relative overflow-visible" style={`width: ${totalW}px; height: ${totalH}px;`}>
		{#each Array.from({ length: width }, (_, col) => col) as col (col)}
			<div
				class="pointer-events-none absolute flex items-end justify-center pb-0.5 text-[10px] font-semibold text-slate-500"
				style={`left: ${LABEL + cellLeft(col)}px; top: 0; width: ${CELL}px; height: ${LABEL}px;`}
			>
				{columnLetter(col)}
			</div>
		{/each}
		{#each Array.from({ length: height }, (_, row) => row) as row (row)}
			<div
				class="pointer-events-none absolute flex items-center justify-end pr-1 text-[10px] font-semibold text-slate-500"
				style={`left: 0; top: ${LABEL + cellTop(row)}px; width: ${LABEL}px; height: ${CELL}px;`}
			>
				{rowNumber(row)}
			</div>
		{/each}

		<div
			class="absolute overflow-visible"
			style={`left: ${LABEL}px; top: ${LABEL}px; width: ${gridW}px; height: ${gridH}px;`}
		>
			{#each Array.from({ length: height }, (_, row) => row) as row (row)}
				{#each Array.from({ length: width }, (_, col) => col) as col (`${row}:${col}`)}
					<div
						class="absolute rounded-md bg-slate-100"
						style={`left: ${cellLeft(col)}px; top: ${cellTop(row)}px; width: ${CELL}px; height: ${CELL}px;`}
					></div>
				{/each}
			{/each}

			{#each buttons as button (button.id)}
				<div
					class="absolute overflow-hidden rounded-md border border-slate-300"
					style={`left: ${cellLeft(button.col_index)}px; top: ${cellTop(button.row_index)}px; width: ${CELL}px; height: ${CELL}px; background-color: ${resolveHex(button)}; color: ${contrastingTextColor(resolveHex(button))};`}
				>
					<ButtonFace
						label={button.label}
						symbolSrc={button.symbol_digest ? symbolUrl(button.symbol_digest) : null}
						variant="preview"
					/>
				</div>
			{/each}

			{#each overlays as overlay, index (index)}
				{#if overlay.kind === 'create'}
					<div
						class="pointer-events-none absolute z-10 rounded-md border-2 border-dashed border-emerald-500"
						style={`left: ${cellLeft(overlay.col)}px; top: ${cellTop(overlay.row)}px; width: ${CELL}px; height: ${CELL}px;`}
					></div>
				{:else if overlay.kind === 'delete'}
					<div
						class="absolute z-10 flex items-center justify-center rounded-md bg-red-500/25"
						style={`left: ${cellLeft(overlay.col)}px; top: ${cellTop(overlay.row)}px; width: ${CELL}px; height: ${CELL}px;`}
					>
						<span class="text-lg font-bold leading-none text-red-600">×</span>
					</div>
				{:else if overlay.kind === 'update'}
					<div
						class="pointer-events-none absolute z-10 rounded-md ring-2 ring-emerald-500 ring-offset-1"
						style={`left: ${cellLeft(overlay.col)}px; top: ${cellTop(overlay.row)}px; width: ${CELL}px; height: ${CELL}px;`}
					></div>
				{:else if overlay.kind === 'insert_snippet'}
					<div
						class="pointer-events-none absolute z-10 rounded-md bg-slate-500/25"
						style={`left: ${cellLeft(overlay.col)}px; top: ${cellTop(overlay.row)}px; width: ${cellSpanSize(overlay.width)}px; height: ${cellSpanSize(overlay.height)}px;`}
					></div>
				{/if}
			{/each}
		</div>

		{#if moveOverlays.length > 0}
			<svg
				class="pointer-events-none absolute inset-0 z-20 overflow-visible"
				width={totalW}
				height={totalH}
			>
				{#each moveOverlays as move, index (index)}
					{@const from = cellCenter(move.fromRow, move.fromCol)}
					{@const to = cellCenter(move.toRow, move.toCol)}
					<defs>
						<marker
							id={`${markerId}-arrow-${index}`}
							markerWidth="6"
							markerHeight="6"
							refX="5"
							refY="3"
							orient="auto"
						>
							<path d="M0,0 L6,3 L0,6 Z" fill="#059669" />
						</marker>
					</defs>
					<circle cx={from.x} cy={from.y} r="3" fill="#059669" opacity="0.7" />
					<line
						x1={from.x}
						y1={from.y}
						x2={to.x}
						y2={to.y}
						stroke="#059669"
						stroke-width="2"
						marker-end={`url(#${markerId}-arrow-${index})`}
					/>
				{/each}
			</svg>
		{/if}

		{#if deleted}
			<div
				class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-md bg-red-50/50"
			>
				<span class="text-4xl font-bold text-red-500">×</span>
			</div>
		{/if}
	</div>
</div>
