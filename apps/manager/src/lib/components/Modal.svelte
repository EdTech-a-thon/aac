<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let {
		open = $bindable(false),
		title,
		onClose,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		onClose?: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		const el = dialog;
		if (!el) return;
		if (open && !el.open) {
			el.showModal();
		} else if (!open && el.open) {
			el.close();
		}
	});

	onMount(() => {
		const el = dialog;
		if (!el) return;
		const handleClose = () => {
			open = false;
			onClose?.();
		};
		el.addEventListener('close', handleClose);
		return () => el.removeEventListener('close', handleClose);
	});

	function requestClose() {
		open = false;
		onClose?.();
	}
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
	onclick={(event) => {
		if (event.target === dialog) requestClose();
	}}
>
	<div class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
		<h2 class="text-base font-semibold text-slate-900">{title}</h2>
		<button
			type="button"
			class="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
			aria-label="Close"
			onclick={requestClose}
		>
			✕
		</button>
	</div>
	<div class="px-5 py-4">
		{@render children()}
	</div>
	{#if footer}
		<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
			{@render footer()}
		</div>
	{/if}
</dialog>
