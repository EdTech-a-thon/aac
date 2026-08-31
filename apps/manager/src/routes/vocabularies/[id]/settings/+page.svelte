<script lang="ts">
	import { page } from '$app/state';
	import { getDashboard } from '$lib/dashboard';
	import { apiFetch } from '$lib/auth';
	import { normalizeHexColor } from '$lib/fitzgeraldColors';
	import DeletePaletteColorModal, {
		type BoundButtonPreview,
		type DeleteResolution
	} from '$lib/components/DeletePaletteColorModal.svelte';
	import VocabularyChangeActions from '$lib/components/VocabularyChangeActions.svelte';
	import {
		getVocabularyEditorSession,
		persistEditorSession,
		replaceEditorLiveFromServer,
		replaceEditorPaletteFromServer,
		subscribeEditorRevision
	} from '$lib/vocabularyEditorSession';
	import type {
		Board,
		BoardButton,
		PaletteColor,
		SnippetInclusion,
		Vocabulary
	} from '$lib/types';

	const dashboard = getDashboard();
	const vocabularyId = $derived(page.params.id ?? '');

	const vocabulary = $derived(
		dashboard.vocabularies.find((entry) => entry.id === vocabularyId) ?? null
	);

	// Null means "not edited since the last save", so the field follows the
	// stored description until the Manager actually types something.
	let descriptionDraft = $state<string | null>(null);
	let savingDescription = $state(false);
	let descriptionError = $state<string | null>(null);

	const storedDescription = $derived(vocabulary?.description ?? '');
	const descriptionValue = $derived(descriptionDraft ?? storedDescription);
	const descriptionDirty = $derived(
		descriptionDraft !== null && descriptionDraft !== storedDescription
	);

	async function saveDescription() {
		if (!dashboard.auth || savingDescription || !descriptionDirty) return;
		savingDescription = true;
		descriptionError = null;
		try {
			const data = await apiFetch<{ vocabulary: Vocabulary }>(`/vocabularies/${vocabularyId}`, {
				method: 'PATCH',
				accessToken: dashboard.auth.session.access_token,
				body: JSON.stringify({ description: descriptionDraft ?? '' })
			});
			dashboard.replaceVocabulary(data.vocabulary);
			descriptionDraft = null;
		} catch (err) {
			descriptionError = err instanceof Error ? err.message : 'Failed to save description';
		} finally {
			savingDescription = false;
		}
	}

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

		const [boardData, paletteData, inclusionData] = await Promise.all([
			apiFetch<{ boards: Board[] }>(`/vocabularies/${id}/boards`, { accessToken }),
			apiFetch<{ paletteColors: PaletteColor[] }>(`/vocabularies/${id}/palette-colors`, {
				accessToken
			}),
			apiFetch<{ snippetInclusions: SnippetInclusion[] }>(
				`/vocabularies/${id}/snippet-inclusions`,
				{ accessToken }
			)
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
				paletteData.paletteColors,
				inclusionData.snippetInclusions
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

	function updateColor(
		id: string,
		patch: Partial<Pick<PaletteColor, 'hex' | 'name' | 'description'>>
	): boolean {
		formError = null;
		if (patch.hex !== undefined) {
			const normalized = normalizeHexColor(patch.hex);
			if (!normalized) {
				formError = 'Color must be a hex value like #RRGGBB.';
				return false;
			}
			patch = { ...patch, hex: normalized };
		}
		setPaletteColors(
			paletteColors.map((color) => (color.id === id ? { ...color, ...patch } : color))
		);
		return true;
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

<div class="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<a
				href={`/vocabularies/${vocabularyId}`}
				class="text-sm font-medium text-blue-700 hover:underline"
			>
				← Back to boards
			</a>
			<h1 class="mt-3 text-2xl font-semibold text-slate-900">Settings</h1>
			<p class="mt-1 text-sm text-slate-600">
				Edit this Vocabulary’s Palette. Changes join the same unsaved set as board edits — use
				Save / Suggest in the header.
			</p>
		</div>
		{#if dashboard.auth}
			<VocabularyChangeActions vocabularyId={vocabularyId} auth={dashboard.auth} />
		{/if}
	</div>

	<section class="max-w-4xl space-y-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Details</h2>

		<div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
			<label class="block space-y-1.5">
				<span class="text-sm font-medium text-slate-700">Description</span>
				<span class="block text-xs text-slate-500">
					What this Vocabulary is for and who it suits. Optional, and saved on its own — this is
					not part of the unsaved set that Save / Suggest applies.
				</span>
				<textarea
					class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					rows="3"
					value={descriptionValue}
					oninput={(event) => {
						descriptionDraft = (event.currentTarget as HTMLTextAreaElement).value;
					}}
				></textarea>
			</label>

			{#if descriptionError}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{descriptionError}</p>
			{/if}

			<div class="flex items-center gap-2">
				<button
					type="button"
					class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={!descriptionDirty || savingDescription}
					onclick={saveDescription}
				>
					{savingDescription ? 'Saving…' : 'Save description'}
				</button>
				{#if descriptionDirty}
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
						disabled={savingDescription}
						onclick={() => {
							descriptionDraft = null;
							descriptionError = null;
						}}
					>
						Cancel
					</button>
				{/if}
			</div>
		</div>
	</section>

	<section class="max-w-4xl space-y-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Palette</h2>

		{#if loading}
			<p class="text-sm text-slate-500">Loading palette…</p>
		{:else if error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{:else}
			{#if formError}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
			{/if}

			<div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
				<table class="w-full table-fixed border-collapse text-left text-sm">
					<colgroup>
						<col class="w-12" />
						<col class="w-44" />
						<col class="w-[22%]" />
						<col />
						<col class="w-24" />
					</colgroup>
					<thead class="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-3 py-2.5 font-medium" scope="col">
								<span class="sr-only">Reorder</span>
							</th>
							<th class="px-3 py-2.5 font-medium" scope="col">Color</th>
							<th class="px-3 py-2.5 font-medium" scope="col">Name</th>
							<th class="px-3 py-2.5 font-medium" scope="col">Description</th>
							<th class="px-3 py-2.5 font-medium" scope="col">
								<span class="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{#if paletteColors.length === 0}
							<tr>
								<td class="px-6 py-16 text-center" colspan="5">
									<p class="text-sm font-medium text-slate-700">No colors in this palette</p>
									<p class="mt-1 text-sm text-slate-500">
										Add a color to use it on board buttons.
									</p>
									<button
										type="button"
										class="mt-4 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
										onclick={addColor}
									>
										Add color
									</button>
								</td>
							</tr>
						{:else}
							{#each paletteColors as color (color.id)}
								<tr class="border-t border-slate-100 first:border-t-0 hover:bg-slate-50/70">
									<td class="px-2 py-2 align-middle">
										<div class="flex flex-col items-center gap-0.5">
											<button
												type="button"
												class="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
												disabled={color.position === 0}
												onclick={() => moveColor(color.id, -1)}
												aria-label="Move up"
											>
												↑
											</button>
											<button
												type="button"
												class="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
												disabled={color.position === paletteColors.length - 1}
												onclick={() => moveColor(color.id, 1)}
												aria-label="Move down"
											>
												↓
											</button>
										</div>
									</td>
									<td class="px-3 py-2 align-middle">
										<div class="flex items-center gap-2">
											<label class="relative size-8 shrink-0 overflow-hidden rounded-md border border-slate-300 shadow-sm">
												<span class="sr-only">Color</span>
												<input
													type="color"
													class="absolute inset-0 size-full cursor-pointer opacity-0"
													value={color.hex}
													onchange={(event) =>
														updateColor(color.id, {
															hex: (event.currentTarget as HTMLInputElement).value
														})}
												/>
												<span
													class="pointer-events-none block size-full"
													style={`background-color: ${color.hex};`}
												></span>
											</label>
											<input
												class="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-500 outline-none focus:text-slate-800"
												value={color.hex}
												spellcheck="false"
												aria-label="Hex color"
												onblur={(event) => {
													const input = event.currentTarget as HTMLInputElement;
													if (input.value === color.hex) return;
													if (!updateColor(color.id, { hex: input.value })) {
														input.value = color.hex;
													}
												}}
											/>
										</div>
									</td>
									<td class="px-3 py-2 align-middle">
										<label class="block">
											<span class="sr-only">Name</span>
											<input
												class="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
												value={color.name}
												placeholder="e.g. Nouns"
												oninput={(event) =>
													updateColor(color.id, {
														name: (event.currentTarget as HTMLInputElement).value
													})}
											/>
										</label>
									</td>
									<td class="px-3 py-2 align-middle">
										<label class="block">
											<span class="sr-only">Description</span>
											<input
												class="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
												value={color.description}
												placeholder="When to choose this color"
												oninput={(event) =>
													updateColor(color.id, {
														description: (event.currentTarget as HTMLInputElement).value
													})}
											/>
										</label>
									</td>
									<td class="px-3 py-2 align-middle">
										<button
											type="button"
											class="rounded-md px-2 py-1 text-sm text-red-700 transition hover:bg-red-50"
											onclick={() => requestDeleteColor(color.id)}
										>
											Delete
										</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
					{#if paletteColors.length > 0}
						<tfoot>
							<tr class="border-t border-slate-200">
								<td class="p-2" colspan="5">
									<button
										type="button"
										class="w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
										onclick={addColor}
									>
										+ Add color
									</button>
								</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			</div>
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
