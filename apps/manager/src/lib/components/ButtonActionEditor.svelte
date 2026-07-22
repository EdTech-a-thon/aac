<script lang="ts">
	import {
		BUTTON_ACTION_KIND_OPTIONS,
		finalizeButtonAction,
		parseYouTubeVideoId,
		youtubeEmbedSrc,
		type ButtonAction,
		type ButtonActionKind
	} from '$lib/buttonAction';
	import type { Board } from '$lib/types';

	let {
		buttonId,
		action,
		label,
		boards,
		currentBoardId,
		onChange
	}: {
		buttonId: string;
		action: ButtonAction | null;
		label: string;
		boards: Board[];
		currentBoardId: string | null;
		onChange: (action: ButtonAction | null) => void;
	} = $props();

	let kind = $state<ButtonActionKind>('none');
	let phrase = $state('');
	let boardId = $state('');
	let videoInput = $state('');
	let start = $state(0);
	let end = $state(10);
	let loadedButtonId = $state<string | null>(null);

	const videoId = $derived(parseYouTubeVideoId(videoInput));
	const previewSrc = $derived(
		videoId && Number.isFinite(start) && Number.isFinite(end) && end > start
			? youtubeEmbedSrc(videoId, start, end)
			: null
	);

	const draftError = $derived.by(() => {
		if (kind === 'none' || kind === 'clear_message_bar' || kind === 'backspace') return null;
		if (kind === 'insert_phrase' || kind === 'speak_immediately') {
			return phrase.trim() ? null : 'Enter a non-empty phrase.';
		}
		if (kind === 'open_board') {
			return boardId ? null : 'Choose a Board in this Vocabulary.';
		}
		if (kind === 'play_youtube_clip') {
			if (!videoId) return 'Paste a YouTube URL or video id.';
			if (!Number.isFinite(start) || start < 0) return 'Start must be a number ≥ 0.';
			if (!Number.isFinite(end) || end <= start) return 'End must be after start.';
			return null;
		}
		return null;
	});

	function loadFromAction(next: ButtonAction | null) {
		if (!next) {
			kind = 'none';
			phrase = label;
			boardId = '';
			videoInput = '';
			start = 0;
			end = 10;
			return;
		}
		if (next.kind === 'insert_phrase' || next.kind === 'speak_immediately') {
			kind = next.kind;
			phrase = next.phrase;
			return;
		}
		if (next.kind === 'open_board') {
			kind = next.kind;
			boardId = next.board_id;
			return;
		}
		if (next.kind === 'play_youtube_clip') {
			kind = next.kind;
			videoInput = next.video_id;
			start = next.start;
			end = next.end;
			return;
		}
		kind = next.kind;
	}

	$effect(() => {
		if (loadedButtonId === buttonId) return;
		loadedButtonId = buttonId;
		loadFromAction(action);
	});

	function commitDrafts() {
		const startSec = typeof start === 'number' ? start : Number(start);
		const endSec = typeof end === 'number' ? end : Number(end);
		const finalized = finalizeButtonAction(kind, {
			phrase,
			boardId,
			videoInput,
			start: startSec,
			end: endSec
		});
		if (finalized === undefined) {
			if (action !== null) onChange(null);
			return;
		}
		onChange(finalized);
	}

	function selectKind(next: ButtonActionKind) {
		kind = next;
		if (next === 'insert_phrase' || next === 'speak_immediately') {
			if (!phrase.trim()) phrase = label;
		}
		if (next === 'open_board' && !boardId) {
			const fallback = boards.find((b) => b.id !== currentBoardId) ?? boards[0];
			boardId = fallback?.id ?? '';
		}
		commitDrafts();
	}

	function boardDisplayName(name: string) {
		const trimmed = name.trim();
		return trimmed ? trimmed : 'Untitled';
	}
</script>

<div class="space-y-3">
	<label class="block space-y-1.5">
		<span class="text-xs font-medium tracking-wide text-slate-500 uppercase">Action</span>
		<select
			class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
			value={kind}
			onchange={(event) => selectKind((event.currentTarget as HTMLSelectElement).value as ButtonActionKind)}
		>
			{#each BUTTON_ACTION_KIND_OPTIONS as option (option.kind)}
				<option value={option.kind}>{option.label}</option>
			{/each}
		</select>
	</label>

	{#if kind === 'insert_phrase' || kind === 'speak_immediately'}
		<label class="block space-y-1.5">
			<span class="text-xs font-medium tracking-wide text-slate-500 uppercase">Phrase</span>
			<input
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="text"
				bind:value={phrase}
				oninput={commitDrafts}
			/>
		</label>
	{:else if kind === 'open_board'}
		<label class="block space-y-1.5">
			<span class="text-xs font-medium tracking-wide text-slate-500 uppercase">Board</span>
			<select
				class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				bind:value={boardId}
				onchange={commitDrafts}
			>
				<option value="">Select a board…</option>
				{#each boards as board (board.id)}
					<option value={board.id}>{boardDisplayName(board.name)}</option>
				{/each}
			</select>
		</label>
	{:else if kind === 'play_youtube_clip'}
		<label class="block space-y-1.5">
			<span class="text-xs font-medium tracking-wide text-slate-500 uppercase"
				>YouTube URL or video id</span
			>
			<input
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="text"
				placeholder="https://www.youtube.com/watch?v=…"
				bind:value={videoInput}
				oninput={commitDrafts}
			/>
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="block space-y-1.5">
				<span class="text-xs font-medium tracking-wide text-slate-500 uppercase"
					>Start (seconds)</span
				>
				<input
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					type="number"
					min="0"
					step="any"
					bind:value={start}
					oninput={commitDrafts}
				/>
			</label>
			<label class="block space-y-1.5">
				<span class="text-xs font-medium tracking-wide text-slate-500 uppercase"
					>End (seconds)</span
				>
				<input
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					type="number"
					min="0"
					step="any"
					bind:value={end}
					oninput={commitDrafts}
				/>
			</label>
		</div>
		{#if previewSrc}
			<div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
				<iframe
					class="aspect-video w-full"
					src={previewSrc}
					title="YouTube clip preview"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			</div>
			<p class="text-xs text-slate-500">
				Preview the clip to confirm start and end. The API does not check video length.
			</p>
		{/if}
	{/if}

	{#if draftError}
		<p class="text-xs text-amber-700">{draftError}</p>
	{/if}
</div>
