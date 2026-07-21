<script lang="ts">
	import { untrack } from 'svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { apiFetch, type AuthState } from '$lib/auth';
	import {
		contrastingTextColor,
		DEFAULT_BUTTON_COLOR,
		FITZGERALD_COLORS,
		normalizeHexColor
	} from '$lib/fitzgeraldColors';
	import type { Board, BoardButton } from '$lib/types';

	let {
		vocabularyId,
		auth
	}: {
		vocabularyId: string;
		auth: AuthState;
	} = $props();

	const CELL = 96;
	const GAP = 8;
	const MIN_ZOOM = 0.15;
	const MAX_ZOOM = 4;

	let boards = $state<Board[]>([]);
	let selectedBoardId = $state<string | null>(null);
	let buttons = $state<BoardButton[]>([]);
	let selectedButtonId = $state<string | null>(null);
	let loadingBoards = $state(true);
	let loadingButtons = $state(false);
	let error = $state<string | null>(null);

	let createOpen = $state(false);
	let newBoardName = $state('');
	let creating = $state(false);
	let createError = $state<string | null>(null);

	let renameOpen = $state(false);
	let renameDraft = $state('');
	let renaming = $state(false);
	let renameError = $state<string | null>(null);

	let deleteOpen = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	let canvasEl = $state<HTMLDivElement | null>(null);
	let panX = $state(0);
	let panY = $state(0);
	let zoom = $state(1);
	let spaceDown = $state(false);
	let isPanning = $state(false);
	let panPointerId = $state<number | null>(null);
	let panOrigin = $state({ x: 0, y: 0, panX: 0, panY: 0 });
	let didPan = $state(false);
	let fittedBoardId = $state<string | null>(null);

	let labelDraft = $state('');
	let colorDraft = $state(DEFAULT_BUTTON_COLOR);
	let savingProps = $state(false);
	let propsError = $state<string | null>(null);
	let labelSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let deletingButton = $state(false);

	let drag = $state<{
		buttonId: string;
		pointerId: number;
		startX: number;
		startY: number;
		originRow: number;
		originCol: number;
		currentRow: number;
		currentCol: number;
		active: boolean;
	} | null>(null);
	let didDrag = $state(false);

	const BOARD_PAD = 12;

	const selectedBoard = $derived(
		boards.find((board) => board.id === selectedBoardId) ?? null
	);

	const selectedButton = $derived(
		buttons.find((button) => button.id === selectedButtonId) ?? null
	);

	const viewportCells = $derived.by(() => {
		const board = selectedBoard;
		if (!board) return [] as { row: number; col: number }[];
		const result: { row: number; col: number }[] = [];
		for (let row = 0; row < board.height; row++) {
			for (let col = 0; col < board.width; col++) {
				result.push({ row, col });
			}
		}
		return result;
	});

	const buttonAtCell = $derived.by(() => {
		const map = new Map<string, BoardButton>();
		for (const button of buttons) {
			const key = `${button.row_index}:${button.col_index}`;
			if (!map.has(key)) map.set(key, button);
		}
		return map;
	});

	const boardPixelWidth = $derived(
		selectedBoard ? selectedBoard.width * CELL + Math.max(0, selectedBoard.width - 1) * GAP : 0
	);
	const boardPixelHeight = $derived(
		selectedBoard
			? selectedBoard.height * CELL + Math.max(0, selectedBoard.height - 1) * GAP
			: 0
	);

	function cellLeft(col: number) {
		return col * (CELL + GAP);
	}

	function cellTop(row: number) {
		return row * (CELL + GAP);
	}

	function clampZoom(value: number) {
		return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
	}

	function fitBoardInView() {
		const board = selectedBoard;
		const el = canvasEl;
		if (!board || !el) return;

		const padding = 64;
		const availableW = Math.max(el.clientWidth - padding * 2, 100);
		const availableH = Math.max(el.clientHeight - padding * 2, 100);
		const nextZoom = clampZoom(
			Math.min(availableW / boardPixelWidth, availableH / boardPixelHeight, 1)
		);
		zoom = nextZoom;
		panX = (el.clientWidth - boardPixelWidth * nextZoom) / 2;
		panY = (el.clientHeight - boardPixelHeight * nextZoom) / 2;
		fittedBoardId = board.id;
	}

	$effect(() => {
		const id = vocabularyId;
		const token = auth.session.access_token;
		let cancelled = false;

		(async () => {
			loadingBoards = true;
			error = null;
			try {
				const data = await apiFetch<{ boards: Board[] }>(`/vocabularies/${id}/boards`, {
					accessToken: token
				});
				if (cancelled) return;
				boards = data.boards;
				if (data.boards.length === 0) {
					selectedBoardId = null;
				} else if (
					!selectedBoardId ||
					!data.boards.some((board) => board.id === selectedBoardId)
				) {
					selectedBoardId = data.boards[0].id;
				}
			} catch (err) {
				if (cancelled) return;
				error = err instanceof Error ? err.message : 'Failed to load boards';
			} finally {
				if (!cancelled) loadingBoards = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const vocabId = vocabularyId;
		const boardId = selectedBoardId;
		const token = auth.session.access_token;
		selectedButtonId = null;
		if (!boardId) {
			buttons = [];
			return;
		}

		let cancelled = false;

		(async () => {
			loadingButtons = true;
			error = null;
			try {
				const data = await apiFetch<{ buttons: BoardButton[] }>(
					`/vocabularies/${vocabId}/boards/${boardId}/buttons`,
					{ accessToken: token }
				);
				if (cancelled) return;
				buttons = data.buttons;
			} catch (err) {
				if (cancelled) return;
				error = err instanceof Error ? err.message : 'Failed to load buttons';
			} finally {
				if (!cancelled) loadingButtons = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const board = selectedBoard;
		const el = canvasEl;
		if (!board || !el) return;
		if (fittedBoardId === board.id) return;

		requestAnimationFrame(() => fitBoardInView());
	});

	$effect(() => {
		const id = selectedButtonId;

		if (labelSaveTimer) {
			clearTimeout(labelSaveTimer);
			labelSaveTimer = null;
		}

		if (!id) {
			labelDraft = '';
			colorDraft = DEFAULT_BUTTON_COLOR;
			propsError = null;
			return;
		}

		const button = untrack(() => buttons.find((b) => b.id === id));
		labelDraft = button?.label ?? '';
		colorDraft = normalizeHexColor(button?.background_color ?? '') ?? DEFAULT_BUTTON_COLOR;
		propsError = null;
	});

	$effect(() => {
		const el = canvasEl;
		if (!el) return;

		function onWheel(event: WheelEvent) {
			onCanvasWheel(event);
		}

		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	function isEditableTarget(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
			return true;
		}
		if (target.isContentEditable) return true;
		return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
	}

	$effect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.code === 'Space' && !isEditableTarget(event.target)) {
				event.preventDefault();
				spaceDown = true;
				return;
			}

			if (
				(event.key === 'Backspace' || event.key === 'Delete') &&
				!isEditableTarget(event.target) &&
				selectedButtonId &&
				!deletingButton
			) {
				event.preventDefault();
				deleteSelectedButton();
			}
		}
		function onKeyUp(event: KeyboardEvent) {
			if (event.code === 'Space') spaceDown = false;
		}
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
		};
	});

	function openCreate() {
		newBoardName = '';
		createError = null;
		createOpen = true;
	}

	async function createBoard(event: SubmitEvent) {
		event.preventDefault();
		creating = true;
		createError = null;
		try {
			const data = await apiFetch<{ board: Board }>(`/vocabularies/${vocabularyId}/boards`, {
				method: 'POST',
				accessToken: auth.session.access_token,
				body: JSON.stringify({ name: newBoardName })
			});
			boards = [...boards, data.board];
			selectedBoardId = data.board.id;
			fittedBoardId = null;
			createOpen = false;
			newBoardName = '';
		} catch (err) {
			createError = err instanceof Error ? err.message : 'Failed to create board';
		} finally {
			creating = false;
		}
	}

	function openRename() {
		if (!selectedBoard) return;
		renameDraft = selectedBoard.name;
		renameError = null;
		renameOpen = true;
	}

	async function renameBoard(event: SubmitEvent) {
		event.preventDefault();
		if (!selectedBoard) return;
		renaming = true;
		renameError = null;
		try {
			const data = await apiFetch<{ board: Board }>(
				`/vocabularies/${vocabularyId}/boards/${selectedBoard.id}`,
				{
					method: 'PATCH',
					accessToken: auth.session.access_token,
					body: JSON.stringify({ name: renameDraft })
				}
			);
			boards = boards.map((board) => (board.id === data.board.id ? data.board : board));
			renameOpen = false;
		} catch (err) {
			renameError = err instanceof Error ? err.message : 'Failed to rename board';
		} finally {
			renaming = false;
		}
	}

	function openDelete() {
		deleteError = null;
		deleteOpen = true;
	}

	async function deleteBoard() {
		if (!selectedBoard) return;
		deleting = true;
		deleteError = null;
		try {
			const id = selectedBoard.id;
			await apiFetch(`/vocabularies/${vocabularyId}/boards/${id}`, {
				method: 'DELETE',
				accessToken: auth.session.access_token
			});
			boards = boards.filter((board) => board.id !== id);
			selectedBoardId = boards[0]?.id ?? null;
			fittedBoardId = null;
			deleteOpen = false;
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete board';
			deleting = false;
		}
	}

	function selectButton(button: BoardButton, event?: MouseEvent) {
		event?.stopPropagation();
		if (didDrag) return;
		selectedButtonId = button.id;
	}

	function clearSelection() {
		if (didPan || didDrag) return;
		selectedButtonId = null;
	}

	function pointerToCell(clientX: number, clientY: number) {
		const el = canvasEl;
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const worldX = (clientX - rect.left - panX) / zoom;
		const worldY = (clientY - rect.top - panY) / zoom;
		const localX = worldX - BOARD_PAD;
		const localY = worldY - BOARD_PAD;
		const col = Math.floor((localX + GAP / 2) / (CELL + GAP));
		const row = Math.floor((localY + GAP / 2) / (CELL + GAP));
		if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
		return { row, col };
	}

	function onButtonPointerDown(button: BoardButton, event: PointerEvent) {
		if (event.button !== 0 || spaceDown) return;
		event.stopPropagation();
		selectedButtonId = button.id;
		didDrag = false;
		drag = {
			buttonId: button.id,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originRow: button.row_index,
			originCol: button.col_index,
			currentRow: button.row_index,
			currentCol: button.col_index,
			active: false
		};
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onButtonPointerMove(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
		if (!drag.active && dist > 6) {
			drag = { ...drag, active: true };
			didDrag = true;
		}
		if (!drag.active) return;
		const cell = pointerToCell(event.clientX, event.clientY);
		if (!cell) return;
		if (cell.row !== drag.currentRow || cell.col !== drag.currentCol) {
			drag = { ...drag, currentRow: cell.row, currentCol: cell.col };
		}
	}

	async function onButtonPointerUp(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const snapshot = drag;
		drag = null;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// already released
		}

		if (!snapshot.active) {
			queueMicrotask(() => {
				didDrag = false;
			});
			return;
		}

		if (
			snapshot.currentRow === snapshot.originRow &&
			snapshot.currentCol === snapshot.originCol
		) {
			queueMicrotask(() => {
				didDrag = false;
			});
			return;
		}

		await moveButton(snapshot.buttonId, snapshot.currentRow, snapshot.currentCol);
		queueMicrotask(() => {
			didDrag = false;
		});
	}

	async function moveButton(buttonId: string, row: number, col: number) {
		const button = buttons.find((b) => b.id === buttonId);
		if (!button || !selectedBoard) return;
		if (button.row_index === row && button.col_index === col) return;

		// Optimistic update
		buttons = buttons.map((b) =>
			b.id === buttonId ? { ...b, row_index: row, col_index: col } : b
		);
		error = null;
		try {
			const data = await apiFetch<{ button: BoardButton }>(
				`/vocabularies/${vocabularyId}/boards/${selectedBoard.id}/buttons/${buttonId}`,
				{
					method: 'PATCH',
					accessToken: auth.session.access_token,
					body: JSON.stringify({ row_index: row, col_index: col })
				}
			);
			buttons = buttons.map((b) => (b.id === data.button.id ? data.button : b));
		} catch (err) {
			buttons = buttons.map((b) =>
				b.id === buttonId
					? { ...b, row_index: button.row_index, col_index: button.col_index }
					: b
			);
			error = err instanceof Error ? err.message : 'Failed to move button';
		}
	}

	async function createButtonAt(row: number, col: number, event?: MouseEvent) {
		event?.stopPropagation();
		if (!selectedBoard || didPan || didDrag || drag?.active) return;
		error = null;
		try {
			const data = await apiFetch<{ button: BoardButton }>(
				`/vocabularies/${vocabularyId}/boards/${selectedBoard.id}/buttons`,
				{
					method: 'POST',
					accessToken: auth.session.access_token,
					body: JSON.stringify({ row_index: row, col_index: col, label: '' })
				}
			);
			buttons = [...buttons, data.button];
			selectedButtonId = data.button.id;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add button';
		}
	}

	async function deleteSelectedButton() {
		const button = selectedButton;
		const board = selectedBoard;
		if (!button || !board || deletingButton) return;

		if (labelSaveTimer) {
			clearTimeout(labelSaveTimer);
			labelSaveTimer = null;
		}

		deletingButton = true;
		propsError = null;
		error = null;
		const previousButtons = buttons;
		const previousSelectedId = selectedButtonId;

		buttons = buttons.filter((b) => b.id !== button.id);
		selectedButtonId = null;

		try {
			await apiFetch(
				`/vocabularies/${vocabularyId}/boards/${board.id}/buttons/${button.id}`,
				{
					method: 'DELETE',
					accessToken: auth.session.access_token
				}
			);
		} catch (err) {
			buttons = previousButtons;
			selectedButtonId = previousSelectedId;
			error = err instanceof Error ? err.message : 'Failed to delete button';
		} finally {
			deletingButton = false;
		}
	}

	async function saveSelectedLabel(label: string = labelDraft) {
		const button = selectedButton;
		if (!button) return;
		if (label === button.label) return;

		const buttonId = button.id;
		const boardId = button.board_id;
		const previousLabel = button.label;
		savingProps = true;
		propsError = null;

		buttons = buttons.map((b) => (b.id === buttonId ? { ...b, label } : b));

		try {
			const data = await apiFetch<{ button: BoardButton }>(
				`/vocabularies/${vocabularyId}/boards/${boardId}/buttons/${buttonId}`,
				{
					method: 'PATCH',
					accessToken: auth.session.access_token,
					body: JSON.stringify({ label })
				}
			);
			// Don't clobber a newer draft the user typed while this request was in flight
			if (selectedButtonId === buttonId && labelDraft !== label) {
				buttons = buttons.map((b) =>
					b.id === buttonId ? { ...b, label: labelDraft } : b
				);
			} else {
				buttons = buttons.map((b) => (b.id === data.button.id ? data.button : b));
			}
		} catch (err) {
			propsError = err instanceof Error ? err.message : 'Failed to save button';
			buttons = buttons.map((b) =>
				b.id === buttonId ? { ...b, label: previousLabel } : b
			);
			if (selectedButtonId === buttonId && labelDraft === label) {
				labelDraft = previousLabel;
			}
		} finally {
			savingProps = false;
			if (selectedButtonId === buttonId && labelDraft !== label && labelDraft !== previousLabel) {
				queueLabelSave();
			}
		}
	}

	function queueLabelSave() {
		propsError = null;
		if (labelSaveTimer) clearTimeout(labelSaveTimer);
		labelSaveTimer = setTimeout(() => {
			labelSaveTimer = null;
			saveSelectedLabel();
		}, 350);
	}

	function flushLabelSave() {
		if (labelSaveTimer) {
			clearTimeout(labelSaveTimer);
			labelSaveTimer = null;
		}
		saveSelectedLabel();
	}

	async function saveSelectedColor(color: string = colorDraft) {
		const button = selectedButton;
		if (!button) return;
		const normalized = normalizeHexColor(color);
		if (!normalized) {
			propsError = 'Color must be a hex value like #RRGGBB.';
			return;
		}
		if (normalized === button.background_color.toLowerCase()) {
			colorDraft = normalized;
			return;
		}

		const buttonId = button.id;
		const boardId = button.board_id;
		const previousColor = button.background_color;
		savingProps = true;
		propsError = null;
		colorDraft = normalized;

		buttons = buttons.map((b) =>
			b.id === buttonId ? { ...b, background_color: normalized } : b
		);

		try {
			const data = await apiFetch<{ button: BoardButton }>(
				`/vocabularies/${vocabularyId}/boards/${boardId}/buttons/${buttonId}`,
				{
					method: 'PATCH',
					accessToken: auth.session.access_token,
					body: JSON.stringify({ background_color: normalized })
				}
			);
			buttons = buttons.map((b) => (b.id === data.button.id ? data.button : b));
			if (selectedButtonId === buttonId) {
				colorDraft =
					normalizeHexColor(data.button.background_color) ?? DEFAULT_BUTTON_COLOR;
			}
		} catch (err) {
			propsError = err instanceof Error ? err.message : 'Failed to save color';
			buttons = buttons.map((b) =>
				b.id === buttonId ? { ...b, background_color: previousColor } : b
			);
			if (selectedButtonId === buttonId) {
				colorDraft = normalizeHexColor(previousColor) ?? DEFAULT_BUTTON_COLOR;
			}
		} finally {
			savingProps = false;
		}
	}

	function buttonDisplayPosition(button: BoardButton) {
		if (drag?.active && drag.buttonId === button.id) {
			return { row: drag.currentRow, col: drag.currentCol };
		}
		return { row: button.row_index, col: button.col_index };
	}

	function onCanvasWheel(event: WheelEvent) {
		const el = canvasEl;
		if (!el) return;
		event.preventDefault();

		if (event.ctrlKey || event.metaKey) {
			const rect = el.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;
			const worldX = (mouseX - panX) / zoom;
			const worldY = (mouseY - panY) / zoom;
			const factor = Math.exp(-event.deltaY * 0.002);
			const nextZoom = clampZoom(zoom * factor);
			panX = mouseX - worldX * nextZoom;
			panY = mouseY - worldY * nextZoom;
			zoom = nextZoom;
			return;
		}

		panX -= event.deltaX;
		panY -= event.deltaY;
	}

	function shouldStartPan(event: PointerEvent) {
		return event.button === 1 || (event.button === 0 && spaceDown);
	}

	function onCanvasPointerDown(event: PointerEvent) {
		if (!shouldStartPan(event) && event.button !== 0) return;
		if (shouldStartPan(event)) {
			event.preventDefault();
			isPanning = true;
			didPan = false;
			panPointerId = event.pointerId;
			panOrigin = { x: event.clientX, y: event.clientY, panX, panY };
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		}
	}

	function onCanvasPointerMove(event: PointerEvent) {
		if (!isPanning || panPointerId !== event.pointerId) return;
		const dx = event.clientX - panOrigin.x;
		const dy = event.clientY - panOrigin.y;
		if (Math.hypot(dx, dy) > 3) didPan = true;
		panX = panOrigin.panX + dx;
		panY = panOrigin.panY + dy;
	}

	function onCanvasPointerUp(event: PointerEvent) {
		if (panPointerId !== event.pointerId) return;
		isPanning = false;
		panPointerId = null;
		queueMicrotask(() => {
			didPan = false;
		});
	}

	function onBackgroundPointerDown(event: PointerEvent) {
		if (event.button !== 0 || spaceDown) return;
		isPanning = true;
		didPan = false;
		panPointerId = event.pointerId;
		panOrigin = { x: event.clientX, y: event.clientY, panX, panY };
		canvasEl?.setPointerCapture(event.pointerId);
	}
</script>

<div class="grid h-full min-h-0 grid-rows-[auto_1fr]">
	<div class="relative z-20 flex items-center justify-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
		{#if loadingBoards}
			<p class="text-sm text-slate-500">Loading boards…</p>
		{:else if boards.length === 0}
			<button
				type="button"
				class="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
				onclick={openCreate}
			>
				+ Create your first board
			</button>
		{:else}
			<Menu align="center">
				{#snippet trigger({ toggle, open })}
					<button
						type="button"
						class="inline-flex min-w-56 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
						onclick={toggle}
						aria-expanded={open}
					>
						<span class="truncate">{selectedBoard?.displayName ?? 'Select board'}</span>
						<span class="text-slate-400" aria-hidden="true">{open ? '▴' : '▾'}</span>
					</button>
				{/snippet}
				{#snippet children({ close })}
					<div class="max-h-64 min-w-56 overflow-y-auto py-1">
						{#each boards as board (board.id)}
							<button
								type="button"
								class="flex w-full items-center px-3 py-2 text-left text-sm transition {board.id ===
								selectedBoardId
									? 'bg-blue-50 font-medium text-blue-800'
									: 'text-slate-700 hover:bg-slate-50'}"
								onclick={() => {
									selectedBoardId = board.id;
									fittedBoardId = null;
									close();
								}}
							>
								{board.displayName}
							</button>
						{/each}
					</div>
					<div class="border-t border-slate-100 p-1">
						<button
							type="button"
							class="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-blue-700 transition hover:bg-blue-50"
							onclick={() => {
								close();
								openCreate();
							}}
						>
							+ New board
						</button>
					</div>
				{/snippet}
			</Menu>

			<Menu>
				{#snippet trigger({ toggle })}
					<button
						type="button"
						class="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
						aria-label="Board options"
						onclick={toggle}
					>
						⋯
					</button>
				{/snippet}
				{#snippet children({ close })}
					<button
						type="button"
						class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
						onclick={() => {
							close();
							openRename();
						}}
					>
						Rename board
					</button>
					<button
						type="button"
						class="block w-full px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
						onclick={() => {
							close();
							openDelete();
						}}
					>
						Delete board
					</button>
				{/snippet}
			</Menu>
		{/if}
	</div>

	{#if error}
		<p class="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
	{/if}

	{#if selectedBoard}
		<div class="grid min-h-0 grid-cols-[1fr_18rem]">
			<!-- Canvas -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={canvasEl}
				role="application"
				aria-label="Board canvas"
				class="relative min-h-0 overflow-hidden bg-slate-100 {spaceDown || isPanning
					? 'cursor-grab'
					: 'cursor-default'} {isPanning ? 'cursor-grabbing' : ''}"
				style="background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px); background-size: 24px 24px; background-position: {panX}px {panY}px;"
				onpointerdown={onCanvasPointerDown}
				onpointermove={onCanvasPointerMove}
				onpointerup={onCanvasPointerUp}
				onpointercancel={onCanvasPointerUp}
			>
				{#if loadingButtons}
					<div class="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/50">
						<p class="text-sm text-slate-500">Loading…</p>
					</div>
				{/if}

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="absolute inset-0"
					onpointerdown={onBackgroundPointerDown}
					onclick={clearSelection}
				></div>

				<div
					class="pointer-events-none absolute origin-top-left will-change-transform"
					style={`transform: translate(${panX}px, ${panY}px) scale(${zoom});`}
				>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="pointer-events-auto relative rounded-2xl border border-slate-300 bg-white p-3 shadow-xl"
						style={`width: ${boardPixelWidth + 24}px; height: ${boardPixelHeight + 24}px;`}
						onclick={(event) => event.stopPropagation()}
					>
						<div class="relative" style={`width: ${boardPixelWidth}px; height: ${boardPixelHeight}px;`}>
							{#each viewportCells as cell (`${cell.row}:${cell.col}`)}
								{@const occupying = buttonAtCell.get(`${cell.row}:${cell.col}`)}
								{@const isDragOrigin =
									drag?.active && occupying && drag.buttonId === occupying.id}
								{@const isDropTarget =
									drag?.active &&
									drag.currentRow === cell.row &&
									drag.currentCol === cell.col}
								<button
									type="button"
									class="absolute rounded-lg transition {isDropTarget
										? 'bg-blue-200 ring-2 ring-blue-400'
										: 'bg-slate-200/90 hover:bg-slate-300'}"
									style={`left: ${cellLeft(cell.col)}px; top: ${cellTop(cell.row)}px; width: ${CELL}px; height: ${CELL}px;`}
									aria-label={`Add button at row ${cell.row}, column ${cell.col}`}
									disabled={Boolean(occupying && !isDragOrigin) || Boolean(drag?.active)}
									onclick={(event) => {
										if (occupying && !isDragOrigin) return;
										createButtonAt(cell.row, cell.col, event);
									}}
								></button>
							{/each}

							{#each buttons as button (button.id)}
								{@const pos = buttonDisplayPosition(button)}
								{@const inViewport =
									selectedBoard &&
									pos.row >= 0 &&
									pos.col >= 0 &&
									pos.row < selectedBoard.height &&
									pos.col < selectedBoard.width}
								{@const isDragging = drag?.active && drag.buttonId === button.id}
								<button
									type="button"
									class="absolute flex items-center justify-center overflow-hidden rounded-lg border px-2 text-center text-sm font-medium shadow-sm transition {isDragging
										? 'z-20 cursor-grabbing border-blue-500 opacity-90 ring-2 ring-blue-500/40'
										: selectedButtonId === button.id
											? 'z-10 cursor-grab border-blue-500 ring-2 ring-blue-500/40'
											: inViewport
												? 'cursor-grab border-slate-300 hover:border-slate-400'
												: 'cursor-grab border-amber-300 hover:border-amber-400'}"
									style={`left: ${cellLeft(pos.col)}px; top: ${cellTop(pos.row)}px; width: ${CELL}px; height: ${CELL}px; background-color: ${button.background_color || DEFAULT_BUTTON_COLOR}; color: ${contrastingTextColor(button.background_color || DEFAULT_BUTTON_COLOR)};`}
									onpointerdown={(event) => onButtonPointerDown(button, event)}
									onpointermove={onButtonPointerMove}
									onpointerup={onButtonPointerUp}
									onpointercancel={onButtonPointerUp}
									onclick={(event) => selectButton(button, event)}
								>
									<span class="line-clamp-3 break-words pointer-events-none">
										{button.label || 'Untitled'}
									</span>
								</button>
							{/each}

							{#if drag?.active && selectedBoard && (drag.currentRow < 0 || drag.currentCol < 0 || drag.currentRow >= selectedBoard.height || drag.currentCol >= selectedBoard.width)}
								<div
									class="pointer-events-none absolute rounded-lg border-2 border-dashed border-blue-400 bg-blue-100/50"
									style={`left: ${cellLeft(drag.currentCol)}px; top: ${cellTop(drag.currentRow)}px; width: ${CELL}px; height: ${CELL}px;`}
								></div>
							{/if}
						</div>
					</div>
				</div>

				<div
					class="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-500 shadow-sm"
				>
					{Math.round(zoom * 100)}% · Scroll to pan · ⌘/Ctrl+scroll to zoom · Drag buttons to move
				</div>
			</div>

			<!-- Properties sidebar -->
			<aside class="flex min-h-0 flex-col border-l border-slate-200 bg-white">
				<div class="border-b border-slate-100 px-4 py-3">
					<h2 class="text-sm font-semibold text-slate-900">Button</h2>
				</div>

				{#if selectedButton}
					<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
						<label class="block space-y-1.5">
							<span class="text-xs font-medium tracking-wide text-slate-500 uppercase">
								Label
								{#if savingProps}
									<span class="font-normal normal-case text-slate-400"> · Saving…</span>
								{/if}
							</span>
							<input
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								type="text"
								bind:value={labelDraft}
								oninput={queueLabelSave}
								onblur={flushLabelSave}
							/>
						</label>

						<div class="space-y-2">
							<span class="text-xs font-medium tracking-wide text-slate-500 uppercase"
								>Background</span
							>
							<div class="grid grid-cols-5 gap-2">
								{#each FITZGERALD_COLORS as swatch (swatch.id)}
									<button
										type="button"
										class="aspect-square rounded-lg border shadow-sm transition hover:scale-105 {colorDraft.toLowerCase() ===
										swatch.hex
											? 'border-blue-500 ring-2 ring-blue-500/40'
											: 'border-slate-300'}"
										style={`background-color: ${swatch.hex};`}
										title="{swatch.label} — {swatch.category}"
										aria-label="{swatch.label}: {swatch.category}"
										aria-pressed={colorDraft.toLowerCase() === swatch.hex}
										onclick={() => saveSelectedColor(swatch.hex)}
									></button>
								{/each}
							</div>
							<label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
								<span class="text-sm text-slate-600">Custom</span>
								<input
									class="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
									type="color"
									bind:value={colorDraft}
									oninput={() => saveSelectedColor(colorDraft)}
								/>
								<span class="font-mono text-xs text-slate-500">{colorDraft}</span>
							</label>
						</div>

						{#if propsError}
							<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{propsError}</p>
						{/if}

						<div class="mt-auto border-t border-slate-100 pt-4">
							<button
								type="button"
								class="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
								disabled={deletingButton}
								onclick={deleteSelectedButton}
							>
								{deletingButton ? 'Deleting…' : 'Delete button'}
							</button>
						</div>
					</div>
				{:else}
					<div class="flex flex-1 items-center justify-center p-6">
						<p class="text-center text-sm text-slate-500">
							Select a button on the board to edit its properties.
						</p>
					</div>
				{/if}
			</aside>
		</div>
	{:else if !loadingBoards}
		<div class="flex min-h-0 items-center justify-center p-8">
			<p class="text-sm text-slate-500">Create a board to start editing.</p>
		</div>
	{/if}
</div>

<Modal bind:open={createOpen} title="New board">
	<form class="space-y-4" id="create-board-form" onsubmit={createBoard}>
		<label class="block space-y-1.5">
			<span class="text-sm font-medium text-slate-700">Name</span>
			<input
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="text"
				placeholder="Untitled"
				bind:value={newBoardName}
			/>
		</label>
		<p class="text-sm text-slate-500">New boards start at 4×4.</p>
		{#if createError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>
		{/if}
	</form>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			onclick={() => (createOpen = false)}
		>
			Cancel
		</button>
		<button
			type="submit"
			form="create-board-form"
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={creating}
		>
			{creating ? 'Creating…' : 'Create'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={renameOpen} title="Rename board">
	<form class="space-y-4" id="rename-board-form" onsubmit={renameBoard}>
		<label class="block space-y-1.5">
			<span class="text-sm font-medium text-slate-700">Name</span>
			<input
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				type="text"
				placeholder="Untitled"
				bind:value={renameDraft}
			/>
		</label>
		{#if renameError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{renameError}</p>
		{/if}
	</form>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			onclick={() => (renameOpen = false)}
		>
			Cancel
		</button>
		<button
			type="submit"
			form="rename-board-form"
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={renaming}
		>
			{renaming ? 'Saving…' : 'Save'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={deleteOpen} title="Delete board">
	<div class="space-y-3">
		<p class="text-sm text-slate-600">
			Delete “{selectedBoard?.displayName ?? 'Untitled'}”? This cannot be undone.
		</p>
		{#if deleteError}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
		{/if}
	</div>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			onclick={() => (deleteOpen = false)}
			disabled={deleting}
		>
			Cancel
		</button>
		<button
			type="button"
			class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
			onclick={deleteBoard}
			disabled={deleting}
		>
			{deleting ? 'Deleting…' : 'Delete'}
		</button>
	{/snippet}
</Modal>
