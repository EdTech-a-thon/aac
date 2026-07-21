<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		align = 'right',
		children,
		trigger
	}: {
		align?: 'left' | 'right' | 'center';
		children: Snippet<[{ close: () => void }]>;
		trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
	} = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	$effect(() => {
		if (!open) return;

		function onPointerDown(event: PointerEvent) {
			if (root && !root.contains(event.target as Node)) {
				close();
			}
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') close();
		}

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<div class="relative" bind:this={root}>
	{@render trigger({ toggle, open })}
	{#if open}
		<div
			class="absolute z-30 mt-1 min-w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg {align ===
			'right'
				? 'right-0'
				: align === 'center'
					? 'left-1/2 -translate-x-1/2'
					: 'left-0'}"
		>
			{@render children({ close })}
		</div>
	{/if}
</div>
