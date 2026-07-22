<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { DEFAULT_BUTTON_COLOR, normalizeHexColor } from '$lib/fitzgeraldColors';
	import type { BoardButton, PaletteColor } from '$lib/types';

	export type BoundButtonPreview = {
		button: BoardButton;
		boardName: string;
	};

	export type DeleteResolution =
		| { kind: 'freeze' }
		| { kind: 'none' }
		| { kind: 'palette'; paletteColorId: string }
		| { kind: 'custom'; hex: string };

	let {
		open = $bindable(false),
		color,
		boundButtons,
		otherPaletteColors,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		color: PaletteColor | null;
		boundButtons: BoundButtonPreview[];
		otherPaletteColors: PaletteColor[];
		onConfirm: (resolution: DeleteResolution) => void;
		onCancel: () => void;
	} = $props();

	let step = $state<1 | 2>(1);
	let mode = $state<'reassign' | 'freeze'>('freeze');
	let reassignKind = $state<'none' | 'palette' | 'custom'>('none');
	let reassignPaletteId = $state<string | null>(null);
	let customHex = $state(DEFAULT_BUTTON_COLOR);
	let formError = $state<string | null>(null);

	$effect(() => {
		if (open) {
			step = 1;
			mode = 'freeze';
			reassignKind = 'none';
			reassignPaletteId = otherPaletteColors[0]?.id ?? null;
			customHex = color?.hex ?? DEFAULT_BUTTON_COLOR;
			formError = null;
		}
	});

	const count = $derived(boundButtons.length);
	const preview = $derived(boundButtons.slice(0, 9));
	const moreCount = $derived(Math.max(0, count - preview.length));

	function close() {
		open = false;
		onCancel();
	}

	function confirmDelete() {
		formError = null;
		if (mode === 'freeze') {
			onConfirm({ kind: 'freeze' });
			open = false;
			return;
		}
		if (reassignKind === 'none') {
			onConfirm({ kind: 'none' });
			open = false;
			return;
		}
		if (reassignKind === 'palette') {
			if (!reassignPaletteId) {
				formError = 'Choose a Palette Color.';
				return;
			}
			onConfirm({ kind: 'palette', paletteColorId: reassignPaletteId });
			open = false;
			return;
		}
		const normalized = normalizeHexColor(customHex);
		if (!normalized) {
			formError = 'Color must be a hex value like #RRGGBB.';
			return;
		}
		onConfirm({ kind: 'custom', hex: normalized });
		open = false;
	}
</script>

{#if color}
	<Modal
		bind:open
		title={step === 1
			? `There ${count === 1 ? 'is' : 'are'} ${count} button${count === 1 ? '' : 's'} with this color`
			: 'Keep the same'}
		onClose={close}
	>
		{#if step === 1}
			<p class="text-sm text-slate-600">
				Are you sure you want to delete this color while it is still in use?
			</p>
			<ul class="mt-4 grid grid-cols-3 gap-2">
				{#each preview as item (item.button.id)}
					<li
						class="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-2 text-center"
					>
						<span
							class="flex size-12 items-center justify-center rounded-md border border-slate-200 text-xs font-medium"
							style={`background-color: ${color.hex};`}
						>
							{(item.button.label.trim() || '·').slice(0, 8)}
						</span>
						<span class="w-full truncate text-[11px] text-slate-500">{item.boardName}</span>
					</li>
				{/each}
			</ul>
			{#if moreCount > 0}
				<p class="mt-2 text-sm text-slate-500">+{moreCount} more</p>
			{/if}
		{:else}
			<p class="text-sm text-slate-600">
				What should happen to buttons that currently use this color?
			</p>
			<div class="mt-4 space-y-3">
				<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
					<input type="radio" class="mt-1" bind:group={mode} value="reassign" />
					<span class="min-w-0 flex-1 space-y-2">
						<span class="block text-sm font-medium text-slate-800">Change to…</span>
						{#if mode === 'reassign'}
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="relative size-8 rounded-md border {reassignKind === 'none'
										? 'border-blue-500 ring-2 ring-blue-500/30'
										: 'border-slate-300'}"
									style="background:#fff"
									title="None"
									onclick={() => (reassignKind = 'none')}
								>
									<span
										class="pointer-events-none absolute inset-1 rounded-full border-2 border-slate-400"
									></span>
									<span
										class="pointer-events-none absolute top-1/2 left-1/2 h-0.5 w-[120%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-400"
									></span>
								</button>
								{#each otherPaletteColors as swatch (swatch.id)}
									<button
										type="button"
										class="size-8 rounded-md border {reassignKind === 'palette' &&
										reassignPaletteId === swatch.id
											? 'border-blue-500 ring-2 ring-blue-500/30'
											: 'border-slate-300'}"
										style={`background-color: ${swatch.hex};`}
										title={swatch.name || swatch.hex}
										onclick={() => {
											reassignKind = 'palette';
											reassignPaletteId = swatch.id;
										}}
									></button>
								{/each}
								<label
									class="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
								>
									Custom
									<input
										type="color"
										class="h-7 w-8 cursor-pointer rounded border border-slate-300 p-0.5"
										bind:value={customHex}
										oninput={() => (reassignKind = 'custom')}
									/>
								</label>
							</div>
						{/if}
					</span>
				</label>

				<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
					<input type="radio" class="mt-1" bind:group={mode} value="freeze" />
					<span class="text-sm text-slate-800">
						Use “custom color” feature to keep button colors the same even after deletion
					</span>
				</label>
			</div>
			{#if formError}
				<p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
			{/if}
		{/if}

		{#snippet footer()}
			{#if step === 1}
				<button
					type="button"
					class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
					onclick={() => (step = 2)}
				>
					Yes, delete this color →
				</button>
				<button
					type="button"
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
					onclick={close}
				>
					No, keep this color
				</button>
			{:else}
				<button
					type="button"
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
					onclick={close}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
					onclick={confirmDelete}
				>
					Delete color
				</button>
			{/if}
		{/snippet}
	</Modal>
{/if}
