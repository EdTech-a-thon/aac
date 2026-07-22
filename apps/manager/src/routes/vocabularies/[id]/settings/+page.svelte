<script lang="ts">
	import { page } from '$app/state';
	import { getDashboard } from '$lib/dashboard';
	import { apiFetch } from '$lib/auth';
	import { normalizeHexColor } from '$lib/fitzgeraldColors';
	import DeletePaletteColorModal, {
		type BoundButtonPreview,
		type DeleteResolution
	} from '$lib/components/DeletePaletteColorModal.svelte';
	import {
		getVocabularyEditorSession,
		persistEditorSession,
		replaceEditorLiveFromServer,
		replaceEditorPaletteFromServer,
		subscribeEditorRevision
	} from '$lib/vocabularyEditorSession';
	import type { Board, BoardButton, PaletteColor } from '$lib/types';

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');

	let revision = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let formError = $state<string | null>(null);

	let deleteOpen = $state(false);
	let deleteTarget = $state<PaletteColor | null>(null);
	let deleteBound = $state<BoundButtonPreview[]>([]);

	$effect(() => subscribeEditorRevision(() => {
		revision += 1;
	}));

	const session = $derived(getVocabularyEditorSession(vocabularyId));
	const paletteColors = $derived.by(() => {
		revision;
		return [...session.paletteColors].sort((a, b) => a.position - b.position);
	});

	async function hydrateEditor(id: string, accessToken: string) {
		const current = getVocabularyEditorSession(id);
		if (current.hydrated && current.paletteHydrated) return;

		const [boardData, paletteData] = await Promise.all([
			apiFetch<{ boards: Board[] }>(`/vocabularies/${id}/boards`, { accessToken }),
			apiFetch<{ paletteColors: PaletteColor[] }>(`/vocabularies/${id}/palette-colors`, {
				accessToken
			})
		]);
		const nextButtonsByBoardId: Record<string, BoardButton[]> = {};
		await Promise.all(
			boardData.boards.map(async (board) => {
				const buttonData = await apiFetch<{ buttons: BoardButton[] }>(
					`/vocabularies/${id}/boards/${board.id}/buttons`,
					{ accessToken }
				);
				nextButtonsByBoardId[board.id] = buttonData.buttons;
			})
		);
		if (!current.hydrated) {
			replaceEditorLiveFromServer(
				current,
				boardData.boards,
				nextButtonsByBoardId,
				paletteData.paletteColors
			);
		} else if (!current.paletteHydrated) {
			replaceEditorPaletteFromServer(current, paletteData.paletteColors);
		}
	}

	$effect(() => {
		const id = vocabularyId;
		const auth = dashboard.auth;
		if (!id || !auth) return;

		let cancelled = false;
		(async () => {
			error = null;
			loading = true;
			try {
				await hydrateEditor(id, auth.session.access_token);
			} catch (err) {
				if (!cancelled) {
					error = err instanceof Error ? err.message : 'Failed to load palette';
				}
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	function setPaletteColors(next: PaletteColor[]) {
		persistEditorSession(session, { paletteColors: next });
	}

	function setButtonsByBoardId(next: Record<string, BoardButton[]>) {
		persistEditorSession(session, { buttonsByBoardId: next });
	}

	function buttonsBoundTo(paletteColorId: string): BoundButtonPreview[] {
		revision;
		const boardName = (boardId: string) => {
			const board = session.boards.find((b) => b.id === boardId);
			const name = board?.name?.trim();
			return name ? name : 'Untitled';
		};
		const result: BoundButtonPreview[] = [];
		for (const list of Object.values(session.buttonsByBoardId)) {
			for (const button of list) {
				if (button.palette_color_id === paletteColorId) {
					result.push({ button, boardName: boardName(button.board_id) });
				}
			}
		}
		return result;
	}

	function updateColor(id: string, patch: Partial<Pick<PaletteColor, 'hex' | 'name' | 'description'>>) {
		formError = null;
		if (patch.hex !== undefined) {
			const normalized = normalizeHexColor(patch.hex);
			if (!normalized) {
				formError = 'Color must be a hex value like #RRGGBB.';
				return;
			}
			patch = { ...patch, hex: normalized };
		}
		setPaletteColors(
			paletteColors.map((color) => (color.id === id ? { ...color, ...patch } : color))
		);
	}

	function addColor() {
		formError = null;
		const now = new Date().toISOString();
		const position =
			paletteColors.reduce((max, color) => Math.max(max, color.position), -1) + 1;
		const color: PaletteColor = {
			id: crypto.randomUUID(),
			vocabulary_id: vocabularyId,
			hex: '#cccccc',
			name: '',
			description: '',
			position,
			created_at: now,
			updated_at: now
		};
		setPaletteColors([...paletteColors, color]);
	}

	function removePaletteColor(id: string) {
		const remaining = paletteColors
			.filter((color) => color.id !== id)
			.map((color, index) => ({ ...color, position: index }));
		setPaletteColors(remaining);
	}

	function requestDeleteColor(id: string) {
		formError = null;
		const color = paletteColors.find((c) => c.id === id);
		if (!color) return;
		const bound = buttonsBoundTo(id);
		if (bound.length === 0) {
			removePaletteColor(id);
			return;
		}
		deleteTarget = color;
		deleteBound = bound;
		deleteOpen = true;
	}

	function applyBoundResolution(resolution: DeleteResolution) {
		if (!deleteTarget) return;
		const colorId = deleteTarget.id;
		const freezeHex = deleteTarget.hex;
		const now = new Date().toISOString();
		const nextButtons: Record<string, BoardButton[]> = {};
		for (const [boardId, list] of Object.entries(session.buttonsByBoardId)) {
			nextButtons[boardId] = list.map((button) => {
				if (button.palette_color_id !== colorId) return button;
				if (resolution.kind === 'freeze') {
					return {
						...button,
						palette_color_id: null,
						background_color: freezeHex,
						updated_at: now
					};
				}
				if (resolution.kind === 'none') {
					return {
						...button,
						palette_color_id: null,
						background_color: null,
						updated_at: now
					};
				}
				if (resolution.kind === 'palette') {
					return {
						...button,
						palette_color_id: resolution.paletteColorId,
						background_color: null,
						updated_at: now
					};
				}
				return {
					...button,
					palette_color_id: null,
					background_color: resolution.hex,
					updated_at: now
				};
			});
		}
		setButtonsByBoardId(nextButtons);
		removePaletteColor(colorId);
		deleteTarget = null;
		deleteBound = [];
	}

	function moveColor(id: string, direction: -1 | 1) {
		const index = paletteColors.findIndex((color) => color.id === id);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= paletteColors.length) return;
		const next = [...paletteColors];
		const [item] = next.splice(index, 1);
		next.splice(target, 0, item);
		setPaletteColors(next.map((color, position) => ({ ...color, position })));
	}
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
			Edit this Vocabulary’s Palette. Changes join the same unsaved Change Set as board edits —
			use Submit / Suggest at the bottom.
		</p>
	</div>

	<section class="space-y-3">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Palette</h2>
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				onclick={addColor}
			>
				Add color
			</button>
		</div>

		{#if loading}
			<p class="text-sm text-slate-500">Loading palette…</p>
		{:else if error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{:else}
			{#if formError}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
			{/if}
			{#if paletteColors.length === 0}
				<p class="text-sm text-slate-500">No Palette Colors yet. Add one to get started.</p>
			{:else}
				<ul class="space-y-3">
					{#each paletteColors as color (color.id)}
						<li class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
							<div class="flex flex-wrap items-start gap-3">
								<label class="block space-y-1">
									<span class="text-xs font-medium text-slate-500">Color</span>
									<input
										type="color"
										class="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
										value={color.hex}
										onchange={(event) =>
											updateColor(color.id, {
												hex: (event.currentTarget as HTMLInputElement).value
											})}
									/>
								</label>
								<label class="min-w-[10rem] flex-1 space-y-1">
									<span class="text-xs font-medium text-slate-500">Name</span>
									<input
										class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
										value={color.name}
										placeholder="e.g. Nouns"
										oninput={(event) =>
											updateColor(color.id, {
												name: (event.currentTarget as HTMLInputElement).value
											})}
									/>
								</label>
								<div class="flex items-center gap-1 pt-5">
									<button
										type="button"
										class="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
										disabled={color.position === 0}
										onclick={() => moveColor(color.id, -1)}
										aria-label="Move up"
									>
										↑
									</button>
									<button
										type="button"
										class="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
										disabled={color.position === paletteColors.length - 1}
										onclick={() => moveColor(color.id, 1)}
										aria-label="Move down"
									>
										↓
									</button>
									<button
										type="button"
										class="rounded border border-red-200 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
										onclick={() => requestDeleteColor(color.id)}
									>
										Delete
									</button>
								</div>
							</div>
							<label class="mt-3 block space-y-1">
								<span class="text-xs font-medium text-slate-500">Description</span>
								<textarea
									class="min-h-[4rem] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
									value={color.description}
									placeholder="When to choose this color"
									oninput={(event) =>
										updateColor(color.id, {
											description: (event.currentTarget as HTMLTextAreaElement).value
										})}
								></textarea>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>
</div>

<DeletePaletteColorModal
	bind:open={deleteOpen}
	color={deleteTarget}
	boundButtons={deleteBound}
	otherPaletteColors={paletteColors.filter((c) => c.id !== deleteTarget?.id)}
	onConfirm={applyBoundResolution}
	onCancel={() => {
		deleteTarget = null;
		deleteBound = [];
	}}
/>
