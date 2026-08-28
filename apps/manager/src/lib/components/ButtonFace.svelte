<script lang="ts">
	/**
	 * The visible face of a Button, shared by the Board canvas, the Snippet
	 * Inclusion layer, and the Suggested Change Set preview. The caller owns the
	 * outer element — its position, border, background colour and text colour —
	 * so that only the face itself is defined in one place.
	 */
	let {
		label,
		symbolSrc = null,
		variant = 'canvas'
	}: {
		label: string;
		symbolSrc?: string | null;
		variant?: 'canvas' | 'preview';
	} = $props();

	const preview = $derived(variant === 'preview');
</script>

{#if symbolSrc}
	<!--
		With a Symbol the label keeps a reserved strip on top — present even when
		the label is blank — so Symbols stay aligned across a row and adding a word
		later does not move the picture.
	-->
	<span class="pointer-events-none flex h-full w-full flex-col">
		<!--
			An explicit height, not just a line-height: an empty span collapses to
			zero, which would slide the Symbol up on unlabelled Buttons and shift it
			again as soon as a word was added.
		-->
		<span
			class="shrink-0 truncate px-0.5 text-center font-medium {preview
				? 'h-2.5 text-[8px] leading-[10px]'
				: 'h-4 text-xs leading-4'}">{label}</span
		>
		<img
			src={symbolSrc}
			alt=""
			draggable="false"
			class="min-h-0 w-full flex-1 object-contain"
		/>
	</span>
{:else}
	<span
		class="pointer-events-none flex h-full w-full items-center justify-center text-center font-medium leading-tight {preview
			? 'px-0.5 text-[9px]'
			: 'px-2 text-sm'}"
	>
		<span class="break-words {preview ? 'line-clamp-2' : 'line-clamp-3'}">{label}</span>
	</span>
{/if}
