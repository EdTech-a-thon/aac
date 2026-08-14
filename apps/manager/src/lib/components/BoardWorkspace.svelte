<script lang="ts">
	import { untrack } from 'svelte';
	import ButtonActionEditor from '$lib/components/ButtonActionEditor.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { apiFetch, type AuthState } from '$lib/auth';
	import { cellRef, columnLetter, rowNumber } from '$lib/boardCellRef';
	import { actionsEqual, type ButtonAction } from '$lib/buttonAction';
	import { normalizeSuggestedChangeSets } from '$lib/describeChangeSetMutations';
	import {
		contrastingTextColor,
		DEFAULT_BUTTON_COLOR,
		normalizeHexColor
	} from '$lib/fitzgeraldColors';
	import { wouldCreateSnippetInclusionCycle } from '$lib/snippetInclusionCycle';
	import {
		isSnippet,
		type Board,
		type BoardButton,
		type GridKind,
		type SnippetInclusion
	} from '$lib/types';
	import {
		getVocabularyEditorSession,
		persistEditorSession,
		replaceEditorLiveFromServer,
		subscribeEditorRevision,
		type SuggestedChangeSet
	} from '$lib/vocabularyEditorSession';

	let {
		vocabularyId,
		auth
	}: {
		vocabularyId: string;
		auth: AuthState;
	} = $props();

	const CELL = 96;
	const GAP = 8;
	const LABEL_GUTTER = 28;
	const MIN_ZOOM = 0.15;
	const MAX_ZOOM = 4;

	const session = $derived(getVocabularyEditorSession(vocabularyId));
	let revision = $state(0);
	$effect(() => subscribeEditorRevision(() => {
		revision += 1;
	}));

	const boards = $derived.by(() => {
		revision;
		return session.boards;
	});
	const buttonsByBoardId = $derived.by(() => {
		revision;
		return session.buttonsByBoardId;
	});
	const snippetInclusions = $derived.by(() => {
		revision;
		return session.snippetInclusions;
	});
	const selectedBoardId = $derived.by(() => {
		revision;
		return session.selectedBoardId;
	});

	const paletteColors = $derived.by(() => {
		revision;
		return session.paletteColors;
	});

	function resolveButtonHex(button: BoardButton): string {
		if (button.palette_color_id) {
			const color = paletteColors.find((c) => c.id === button.palette_color_id);
			if (color) return color.hex;
		}
		return button.background_color ?? DEFAULT_BUTTON_COLOR;
	}

	type CanvasSelection =
		| { kind: 'button'; id: string }
		| { kind: 'inclusion'; id: string }
		| null;

	let selection = $state<CanvasSelection>(null);
	let loadingBoards = $state(true);
	let loadingButtons = $state(true);
	let error = $state<string | null>(null);

	function setBoards(next: Board[]) {
		persistEditorSession(session, { boards: next });
	}

	function setButtonsByBoardId(next: Record<string, BoardButton[]>) {
		persistEditorSession(session, { buttonsByBoardId: next });
	}

	function setSnippetInclusions(next: SnippetInclusion[]) {
		persistEditorSession(session, { snippetInclusions: next });
	}

	function setSelectedBoardId(next: string | null) {
		persistEditorSession(session, { selectedBoardId: next });
	}

	let createOpen = $state(false);
	let createKind = $state<GridKind>('board');
	let newBoardName = $state('');
	let newBoardWidth = $state(6);
	let newBoardHeight = $state(5);
	let createError = $state<string | null>(null);

	let renameOpen = $state(false);
	let renameDraft = $state('');
	let renameError = $state<string | null>(null);

	let deleteOpen = $state(false);
	let deleteError = $state<string | null>(null);

	let canvasEl = $state<HTMLDivElement | null>(null);
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	let panX = $state(0);
	let panY = $state(0);
	let zoom = $state(1);
	let spaceDown = $state(false);
	let isPanning = $state(false);
	let panPointerId = $state<number | null>(null);
	let panOrigin = $state({ x: 0, y: 0, panX: 0, panY: 0 });
	let didPan = $state(false);
	let panFromBackground = $state(false);
	let fittedBoardId = $state<string | null>(null);

	let labelDraft = $state('');
	let colorDraft = $state(DEFAULT_BUTTON_COLOR);
	let widthDraft = $state(4);
	let heightDraft = $state(4);
	let propsError = $state<string | null>(null);
	let boardSizeError = $state<string | null>(null);

	type ItemDrag = {
		kind: 'button' | 'inclusion';
		id: string;
		pointerId: number;
		startX: number;
		startY: number;
		originRow: number;
		originCol: number;
		currentRow: number;
		currentCol: number;
		grabOffsetX: number;
		grabOffsetY: number;
		grabLocalRow: number;
		grabLocalCol: number;
		floatX: number;
		floatY: number;
		active: boolean;
	};
	let drag = $state<ItemDrag | null>(null);
	let didDrag = $state(false);
	let cellMenu = $state<{ row: number; col: number; x: number; y: number } | null>(null);
	let insertSnippetOpen = $state(false);
	let insertSnippetCell = $state<{ row: number; col: number } | null>(null);

	const BOARD_PAD = 12;

	const buttons = $derived(
		selectedBoardId ? (buttonsByBoardId[selectedBoardId] ?? []) : []
	);

	const destinationBoards = $derived(boards.filter((board) => !isSnippet(board)));
	const snippets = $derived(boards.filter(isSnippet));
	const insertableSnippets = $derived.by(() => {
		if (!selectedBoardId) return [] as Board[];
		return snippets.filter(
			(snippet) =>
				!wouldCreateSnippetInclusionCycle(snippetInclusions, selectedBoardId, snippet.id)
		);
	});

	function withGridKind(board: Board): Board {
		return { ...board, kind: board.kind === 'snippet' ? 'snippet' : 'board' };
	}

	const selectedBoard = $derived(
		boards.find((board) => board.id === selectedBoardId) ?? null
	);

	const selectedGridNoun = $derived(selectedBoard && isSnippet(selectedBoard) ? 'snippet' : 'board');

	const selectedButton = $derived.by(() => {
		const current = selection;
		if (current?.kind !== 'button') return null;
		return buttons.find((button) => button.id === current.id) ?? null;
	});

	const hostInclusions = $derived.by(() => {
		if (!selectedBoardId) return [] as SnippetInclusion[];
		return snippetInclusions
			.filter((inc) => inc.host_id === selectedBoardId)
			.slice()
			.sort((a, b) => {
				if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
				return a.id < b.id ? -1 : 1;
			});
	});

	const selectedInclusion = $derived.by(() => {
		const current = selection;
		if (current?.kind !== 'inclusion') return null;
		return hostInclusions.find((inc) => inc.id === current.id) ?? null;
	});

	const selectedInclusionSnippet = $derived(
		selectedInclusion
			? (boards.find((board) => board.id === selectedInclusion.snippet_id) ?? null)
			: null
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
	const boardContentWidth = $derived(boardPixelWidth + LABEL_GUTTER);
	const boardContentHeight = $derived(boardPixelHeight + LABEL_GUTTER);

	const boardFramePad = BOARD_PAD * 2;

	const isBoardOffscreen = $derived.by(() => {
		if (!selectedBoard || canvasWidth <= 0 || canvasHeight <= 0) return false;
		const frameW = (boardContentWidth + boardFramePad) * zoom;
		const frameH = (boardContentHeight + boardFramePad) * zoom;
		const left = panX;
		const top = panY;
		const right = left + frameW;
		const bottom = top + frameH;
		return right < 0 || left > canvasWidth || bottom < 0 || top > canvasHeight;
	});

	function setCurrentBoardButtons(next: BoardButton[]) {
		if (!selectedBoardId) return;
		setButtonsByBoardId({ ...buttonsByBoardId, [selectedBoardId]: next });
	}

	function boardDisplayName(name: string) {
		const trimmed = name.trim();
		return trimmed ? trimmed : 'Untitled';
	}

	function cellLeft(col: number) {
		return col * (CELL + GAP);
	}

	function cellTop(row: number) {
		return row * (CELL + GAP);
	}

	function snippetForInclusion(inc: SnippetInclusion) {
		return boards.find((board) => board.id === inc.snippet_id) ?? null;
	}

	function inclusionContainsCell(inc: SnippetInclusion, row: number, col: number) {
		const snippet = snippetForInclusion(inc);
		if (!snippet) return false;
		const localRow = row - inc.origin_row;
		const localCol = col - inc.origin_col;
		return (
			localRow >= 0 &&
			localCol >= 0 &&
			localRow < snippet.height &&
			localCol < snippet.width
		);
	}

	function newestInclusionAt(row: number, col: number) {
		let newest: SnippetInclusion | null = null;
		for (const inc of hostInclusions) {
			if (drag?.active && drag.kind === 'inclusion' && drag.id === inc.id) continue;
			if (!inclusionContainsCell(inc, row, col)) continue;
			if (
				!newest ||
				inc.created_at > newest.created_at ||
				(inc.created_at === newest.created_at && inc.id > newest.id)
			) {
				newest = inc;
			}
		}
		return newest;
	}

	function inclusionRect(
		inc: SnippetInclusion,
		originRow = inc.origin_row,
		originCol = inc.origin_col
	) {
		const snippet = snippetForInclusion(inc);
		if (!snippet) return null;
		return {
			row: originRow,
			col: originCol,
			width: snippet.width,
			height: snippet.height
		};
	}

	function dragPreviewRect(item: ItemDrag) {
		if (item.kind === 'button') {
			return { row: item.currentRow, col: item.currentCol, width: 1, height: 1 };
		}
		const inc = snippetInclusions.find((entry) => entry.id === item.id);
		if (!inc) return { row: item.currentRow, col: item.currentCol, width: 1, height: 1 };
		return (
			inclusionRect(inc, item.currentRow, item.currentCol) ?? {
				row: item.currentRow,
				col: item.currentCol,
				width: 1,
				height: 1
			}
		);
	}

	function cellSpanSize(count: number) {
		return count * CELL + Math.max(0, count - 1) * GAP;
	}

	function mappedButtonsInInclusion(
		snippetId: string,
		originRow: number,
		originCol: number,
		visiting: Set<string> = new Set()
	): { button: BoardButton; hostRow: number; hostCol: number }[] {
		if (visiting.has(snippetId)) return [];
		const snippet = boards.find((board) => board.id === snippetId);
		if (!snippet) return [];
		const nextVisiting = new Set(visiting);
		nextVisiting.add(snippetId);
		const mapped: { button: BoardButton; hostRow: number; hostCol: number }[] = [];
		const nested = snippetInclusions
			.filter((inc) => inc.host_id === snippetId)
			.slice()
			.sort((a, b) => {
				if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
				return a.id < b.id ? -1 : 1;
			});
		for (const child of nested) {
			mapped.push(
				...mappedButtonsInInclusion(
					child.snippet_id,
					originRow + child.origin_row,
					originCol + child.origin_col,
					nextVisiting
				)
			);
		}
		for (const button of buttonsByBoardId[snippetId] ?? []) {
			if (
				button.row_index < 0 ||
				button.col_index < 0 ||
				button.row_index >= snippet.height ||
				button.col_index >= snippet.width
			) {
				continue;
			}
			mapped.push({
				button,
				hostRow: originRow + button.row_index,
				hostCol: originCol + button.col_index
			});
		}
		return mapped;
	}

	function clampZoom(value: number) {
		return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
	}

	function fitBoardInView() {
		const board = selectedBoard;
		const el = canvasEl;
		if (!board || !el) return;

		// Bounds in the transformed board-frame's local space (origin = card top-left).
		let minX = 0;
		let minY = 0;
		let maxX = boardContentWidth + boardFramePad;
		let maxY = boardContentHeight + boardFramePad;

		for (const button of buttons) {
			const left = BOARD_PAD + LABEL_GUTTER + cellLeft(button.col_index);
			const top = BOARD_PAD + LABEL_GUTTER + cellTop(button.row_index);
			minX = Math.min(minX, left);
			minY = Math.min(minY, top);
			maxX = Math.max(maxX, left + CELL);
			maxY = Math.max(maxY, top + CELL);
		}

		for (const inc of hostInclusions) {
			const rect = inclusionRect(inc);
			if (!rect) continue;
			const left = BOARD_PAD + LABEL_GUTTER + cellLeft(rect.col);
			const top = BOARD_PAD + LABEL_GUTTER + cellTop(rect.row);
			minX = Math.min(minX, left);
			minY = Math.min(minY, top);
			maxX = Math.max(maxX, left + cellSpanSize(rect.width));
			maxY = Math.max(maxY, top + cellSpanSize(rect.height));
		}

		const contentW = Math.max(maxX - minX, 1);
		const contentH = Math.max(maxY - minY, 1);
		const padding = 64;
		const availableW = Math.max(el.clientWidth - padding * 2, 100);
		const availableH = Math.max(el.clientHeight - padding * 2, 100);
		const nextZoom = clampZoom(
			Math.min(availableW / contentW, availableH / contentH, 1)
		);
		zoom = nextZoom;
		panX = (el.clientWidth - contentW * nextZoom) / 2 - minX * nextZoom;
		panY = (el.clientHeight - contentH * nextZoom) / 2 - minY * nextZoom;
		fittedBoardId = board.id;
	}

	$effect(() => {
		const id = vocabularyId;
		const token = auth.session.access_token;
		const current = getVocabularyEditorSession(id);
		let cancelled = false;

		(async () => {
			error = null;

			async function refreshSuggested() {
				try {
					const suggested = await apiFetch<{ changeSets: SuggestedChangeSet[] }>(
						`/vocabularies/${id}/change-sets?status=suggested`,
						{ accessToken: token }
					);
					if (!cancelled) {
						persistEditorSession(current, {
							suggestedChangeSets: normalizeSuggestedChangeSets(suggested.changeSets)
						});
					}
				} catch {
					if (!cancelled) {
						persistEditorSession(current, { suggestedChangeSets: [] });
					}
				}
			}

			if (current.hydrated) {
				loadingBoards = false;
				loadingButtons = false;
				await refreshSuggested();
				return;
			}

			loadingBoards = true;
			loadingButtons = true;
			try {
				const [data, paletteData, inclusionData] = await Promise.all([
					apiFetch<{ boards: Board[] }>(`/vocabularies/${id}/boards`, {
						accessToken: token
					}),
					apiFetch<{ paletteColors: import('$lib/types').PaletteColor[] }>(
						`/vocabularies/${id}/palette-colors`,
						{ accessToken: token }
					),
					apiFetch<{ snippetInclusions: SnippetInclusion[] }>(
						`/vocabularies/${id}/snippet-inclusions`,
						{ accessToken: token }
					)
				]);
				if (cancelled) return;

				const nextButtonsByBoardId: Record<string, BoardButton[]> = {};
				await Promise.all(
					data.boards.map(async (board) => {
						const buttonData = await apiFetch<{ buttons: BoardButton[] }>(
							`/vocabularies/${id}/boards/${board.id}/buttons`,
							{ accessToken: token }
						);
						if (!cancelled) {
							nextButtonsByBoardId[board.id] = buttonData.buttons;
						}
					})
				);
				if (cancelled) return;

				replaceEditorLiveFromServer(
					current,
					data.boards.map(withGridKind),
					nextButtonsByBoardId,
					paletteData.paletteColors,
					inclusionData.snippetInclusions
				);
				await refreshSuggested();
			} catch (err) {
				if (cancelled) return;
				error = err instanceof Error ? err.message : 'Failed to load boards';
			} finally {
				if (!cancelled) {
					loadingBoards = false;
					loadingButtons = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		selectedBoardId;
		selection = null;
		cellMenu = null;
	});

	$effect(() => {
		revision;
		const current = selection;
		if (
			current?.kind === 'button' &&
			!buttons.some((button) => button.id === current.id)
		) {
			selection = null;
		} else if (
			current?.kind === 'inclusion' &&
			!hostInclusions.some((inc) => inc.id === current.id)
		) {
			selection = null;
		}
	});

	$effect(() => {
		const board = selectedBoard;
		const el = canvasEl;
		if (!board || !el) return;
		if (fittedBoardId === board.id) return;

		requestAnimationFrame(() => fitBoardInView());
	});

	$effect(() => {
		const id = selectedBoardId;
		if (!id) {
			widthDraft = 4;
			heightDraft = 4;
			boardSizeError = null;
			return;
		}
		const board = untrack(() => boards.find((b) => b.id === id));
		widthDraft = board?.width ?? 4;
		heightDraft = board?.height ?? 4;
		boardSizeError = null;
	});

	$effect(() => {
		const id = selection?.kind === 'button' ? selection.id : null;

		if (!id) {
			labelDraft = '';
			colorDraft = DEFAULT_BUTTON_COLOR;
			propsError = null;
			return;
		}

		const button = untrack(() => buttons.find((b) => b.id === id));
		labelDraft = button?.label ?? '';
		colorDraft =
			normalizeHexColor(button?.background_color ?? '') ??
			normalizeHexColor(untrack(() => (button ? resolveButtonHex(button) : ''))) ??
			DEFAULT_BUTTON_COLOR;
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

	$effect(() => {
		const el = canvasEl;
		if (!el) {
			canvasWidth = 0;
			canvasHeight = 0;
			return;
		}

		const syncSize = () => {
			canvasWidth = el.clientWidth;
			canvasHeight = el.clientHeight;
		};
		syncSize();

		const observer = new ResizeObserver(syncSize);
		observer.observe(el);
		return () => observer.disconnect();
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
				!isEditableTarget(event.target)
			) {
				if (selection?.kind === 'inclusion') {
					event.preventDefault();
					deleteSelectedInclusion();
				} else if (selection?.kind === 'button') {
					event.preventDefault();
					deleteSelectedButton();
				}
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

	function openCreate(kind: GridKind = 'board') {
		createKind = kind;
		newBoardName = '';
		newBoardWidth = 6;
		newBoardHeight = kind === 'snippet' ? 1 : 5;
		createError = null;
		createOpen = true;
	}

	function createBoard(event: SubmitEvent) {
		event.preventDefault();
		createError = null;
		const name = newBoardName;
		const width = Number(newBoardWidth);
		const height = Number(newBoardHeight);
		if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
			createError = 'Width and height must be integers ≥ 1.';
			return;
		}
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const board: Board = {
			id,
			vocabulary_id: vocabularyId,
			name,
			displayName: boardDisplayName(name),
			width,
			height,
			kind: createKind,
			created_at: now,
			updated_at: now
		};
		setBoards([...boards, board]);
		setButtonsByBoardId({ ...buttonsByBoardId, [id]: [] });
		setSelectedBoardId(id);
		fittedBoardId = null;
		createOpen = false;
		newBoardName = '';
		newBoardWidth = 6;
		newBoardHeight = 5;
	}

	function openRename() {
		if (!selectedBoard) return;
		renameDraft = selectedBoard.name;
		renameError = null;
		renameOpen = true;
	}

	function renameBoard(event: SubmitEvent) {
		event.preventDefault();
		if (!selectedBoard) return;
		renameError = null;
		const name = renameDraft;
		const now = new Date().toISOString();
		setBoards(
			boards.map((board) =>
				board.id === selectedBoard.id
					? { ...board, name, displayName: boardDisplayName(name), updated_at: now }
					: board
			)
		);
		renameOpen = false;
	}

	function openDelete() {
		deleteError = null;
		deleteOpen = true;
	}

	function deleteBoard() {
		if (!selectedBoard) return;
		deleteError = null;
		const id = selectedBoard.id;
		const nextBoards = boards.filter((board) => board.id !== id);
		const { [id]: _removed, ...rest } = buttonsByBoardId;
		// Mirror server: clearing Open Board Actions that targeted the deleted Board.
		const cleared: Record<string, BoardButton[]> = {};
		for (const [boardId, list] of Object.entries(rest)) {
			cleared[boardId] = list.map((button) =>
				button.action?.kind === 'open_board' && button.action.board_id === id
					? { ...button, action: null, updated_at: new Date().toISOString() }
					: button
			);
		}
		setBoards(nextBoards);
		setButtonsByBoardId(cleared);
		setSnippetInclusions(
			snippetInclusions.filter((inc) => inc.host_id !== id && inc.snippet_id !== id)
		);
		const sameKind = nextBoards.filter((board) => board.kind === selectedBoard.kind);
		setSelectedBoardId(sameKind[0]?.id ?? nextBoards[0]?.id ?? null);
		fittedBoardId = null;
		deleteOpen = false;
	}

	function isSelected(kind: 'button' | 'inclusion', id: string) {
		return selection?.kind === kind && selection?.id === id;
	}

	function selectButton(button: BoardButton, event?: MouseEvent) {
		event?.stopPropagation();
		if (didDrag) return;
		selection = { kind: 'button', id: button.id };
		cellMenu = null;
	}

	function selectInclusion(inc: SnippetInclusion, event?: MouseEvent) {
		event?.stopPropagation();
		if (didDrag) return;
		selection = { kind: 'inclusion', id: inc.id };
		cellMenu = null;
	}

	function clearSelection() {
		if (didPan || didDrag) return;
		selection = null;
		cellMenu = null;
	}

	function pointerToBoardLocal(clientX: number, clientY: number) {
		const el = canvasEl;
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const worldX = (clientX - rect.left - panX) / zoom;
		const worldY = (clientY - rect.top - panY) / zoom;
		return {
			x: worldX - BOARD_PAD - LABEL_GUTTER,
			y: worldY - BOARD_PAD - LABEL_GUTTER
		};
	}

	function pointerToCell(clientX: number, clientY: number) {
		const local = pointerToBoardLocal(clientX, clientY);
		if (!local) return null;
		const col = Math.floor((local.x + GAP / 2) / (CELL + GAP));
		const row = Math.floor((local.y + GAP / 2) / (CELL + GAP));
		if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
		return { row, col };
	}

	function dropTargetBlocked(row: number, col: number, buttonId: string) {
		const occupant = buttonAtCell.get(`${row}:${col}`);
		return Boolean(occupant && occupant.id !== buttonId);
	}

	function beginItemDrag(
		kind: 'button' | 'inclusion',
		id: string,
		originRow: number,
		originCol: number,
		event: PointerEvent,
		grabLocalRow = 0,
		grabLocalCol = 0
	) {
		didDrag = false;
		const originLeft = cellLeft(originCol);
		const originTop = cellTop(originRow);
		const local = pointerToBoardLocal(event.clientX, event.clientY);
		drag = {
			kind,
			id,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originRow,
			originCol,
			currentRow: originRow,
			currentCol: originCol,
			grabOffsetX: local ? local.x - originLeft : CELL / 2,
			grabOffsetY: local ? local.y - originTop : CELL / 2,
			grabLocalRow,
			grabLocalCol,
			floatX: originLeft,
			floatY: originTop,
			active: false
		};
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onButtonPointerDown(button: BoardButton, event: PointerEvent) {
		if (event.button !== 0 || spaceDown) return;
		event.stopPropagation();
		selection = { kind: 'button', id: button.id };
		cellMenu = null;
		beginItemDrag('button', button.id, button.row_index, button.col_index, event);
	}

	function onItemPointerMove(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
		if (!drag.active && dist > 6) {
			drag = { ...drag, active: true };
			didDrag = true;
		}
		if (!drag.active) return;

		const local = pointerToBoardLocal(event.clientX, event.clientY);
		const cell = pointerToCell(event.clientX, event.clientY);
		const nextFloatX = local ? local.x - drag.grabOffsetX : drag.floatX;
		const nextFloatY = local ? local.y - drag.grabOffsetY : drag.floatY;
		const nextRow =
			cell == null
				? drag.currentRow
				: drag.kind === 'inclusion'
					? cell.row - drag.grabLocalRow
					: cell.row;
		const nextCol =
			cell == null
				? drag.currentCol
				: drag.kind === 'inclusion'
					? cell.col - drag.grabLocalCol
					: cell.col;
		if (
			nextFloatX !== drag.floatX ||
			nextFloatY !== drag.floatY ||
			nextRow !== drag.currentRow ||
			nextCol !== drag.currentCol
		) {
			drag = {
				...drag,
				floatX: nextFloatX,
				floatY: nextFloatY,
				currentRow: nextRow,
				currentCol: nextCol
			};
		}
	}

	function onItemPointerUp(event: PointerEvent) {
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

		if (
			snapshot.kind === 'button' &&
			dropTargetBlocked(snapshot.currentRow, snapshot.currentCol, snapshot.id)
		) {
			queueMicrotask(() => {
				didDrag = false;
			});
			return;
		}

		if (snapshot.kind === 'button') {
			moveButton(snapshot.id, snapshot.currentRow, snapshot.currentCol);
		} else {
			moveInclusion(snapshot.id, snapshot.currentRow, snapshot.currentCol);
		}
		queueMicrotask(() => {
			didDrag = false;
		});
	}

	function onInclusionPointerDown(inc: SnippetInclusion, event: PointerEvent) {
		if (event.button !== 0 || spaceDown) return;
		event.stopPropagation();
		selection = { kind: 'inclusion', id: inc.id };
		cellMenu = null;
		const cell = pointerToCell(event.clientX, event.clientY);
		const grabLocalRow = cell ? cell.row - inc.origin_row : 0;
		const grabLocalCol = cell ? cell.col - inc.origin_col : 0;
		beginItemDrag(
			'inclusion',
			inc.id,
			inc.origin_row,
			inc.origin_col,
			event,
			grabLocalRow,
			grabLocalCol
		);
	}

	function moveButton(buttonId: string, row: number, col: number) {
		const button = buttons.find((b) => b.id === buttonId);
		if (!button || !selectedBoardId) return;
		if (button.row_index === row && button.col_index === col) return;

		setCurrentBoardButtons(
			buttons.map((b) =>
				b.id === buttonId
					? { ...b, row_index: row, col_index: col, updated_at: new Date().toISOString() }
					: b
			)
		);
	}

	function createButtonAt(row: number, col: number, event?: MouseEvent) {
		event?.stopPropagation();
		if (!selectedBoard || !selectedBoardId || didPan || didDrag || drag?.active) return;
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const button: BoardButton = {
			id,
			board_id: selectedBoardId,
			row_index: row,
			col_index: col,
			label: '',
			background_color: null,
			palette_color_id: null,
			action: null,
			created_at: now,
			updated_at: now
		};
		setCurrentBoardButtons([...buttons, button]);
		selection = { kind: 'button', id };
		cellMenu = null;
	}

	function deleteSelectedButton() {
		const button = selectedButton;
		if (!button) return;

		setCurrentBoardButtons(buttons.filter((b) => b.id !== button.id));
		selection = null;
		propsError = null;
	}

	function insertSnippetAt(snippetId: string, row: number, col: number) {
		if (!selectedBoardId || !selectedBoard) return;
		const snippet = boards.find((board) => board.id === snippetId && isSnippet(board));
		if (!snippet) return;
		if (wouldCreateSnippetInclusionCycle(snippetInclusions, selectedBoardId, snippetId)) return;
		const now = new Date().toISOString();
		const inclusion: SnippetInclusion = {
			id: crypto.randomUUID(),
			host_id: selectedBoardId,
			snippet_id: snippetId,
			origin_row: row,
			origin_col: col,
			created_at: now,
			updated_at: now
		};
		setSnippetInclusions([...snippetInclusions, inclusion]);
		selection = { kind: 'inclusion', id: inclusion.id };
		insertSnippetOpen = false;
		insertSnippetCell = null;
		cellMenu = null;
	}

	function moveInclusion(inclusionId: string, originRow: number, originCol: number) {
		const existing = snippetInclusions.find((inc) => inc.id === inclusionId);
		if (!existing) return;
		if (existing.origin_row === originRow && existing.origin_col === originCol) return;
		setSnippetInclusions(
			snippetInclusions.map((inc) =>
				inc.id === inclusionId
					? { ...inc, origin_row: originRow, origin_col: originCol, updated_at: new Date().toISOString() }
					: inc
			)
		);
	}

	function deleteSelectedInclusion() {
		const inclusion = selectedInclusion;
		if (!inclusion) return;
		setSnippetInclusions(snippetInclusions.filter((inc) => inc.id !== inclusion.id));
		selection = null;
	}

	function openSnippetCanvas(snippetId: string) {
		setSelectedBoardId(snippetId);
		fittedBoardId = null;
		selection = null;
	}

	function openInsertSnippet(row: number, col: number) {
		insertSnippetCell = { row, col };
		insertSnippetOpen = true;
		cellMenu = null;
	}

	function onEmptyCellContextMenu(row: number, col: number, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (buttonAtCell.get(`${row}:${col}`)) return;
		if (newestInclusionAt(row, col)) return;
		cellMenu = { row, col, x: event.clientX, y: event.clientY };
	}

	function updateSelectedLabel(label: string = labelDraft) {
		const button = selectedButton;
		if (!button) return;
		if (label === button.label) return;

		const previousLabel = button.label;
		setCurrentBoardButtons(
			buttons.map((b) => {
				if (b.id !== button.id) return b;
				let nextAction = b.action;
				if (
					(nextAction?.kind === 'insert_phrase' || nextAction?.kind === 'speak_immediately') &&
					nextAction.phrase === previousLabel
				) {
					nextAction = label.trim()
						? { kind: nextAction.kind, phrase: label }
						: null;
				}
				return {
					...b,
					label,
					action: nextAction,
					updated_at: new Date().toISOString()
				};
			})
		);
	}

	function updateSelectedAction(action: ButtonAction | null) {
		const button = selectedButton;
		if (!button) return;
		if (actionsEqual(button.action, action)) return;

		setCurrentBoardButtons(
			buttons.map((b) =>
				b.id === button.id ? { ...b, action, updated_at: new Date().toISOString() } : b
			)
		);
	}

	function updateSelectedColor(color: string = colorDraft) {
		const button = selectedButton;
		if (!button) return;
		const normalized = normalizeHexColor(color);
		if (!normalized) {
			propsError = 'Color must be a hex value like #RRGGBB.';
			return;
		}
		propsError = null;
		if (
			button.palette_color_id === null &&
			button.background_color?.toLowerCase() === normalized
		) {
			colorDraft = normalized;
			return;
		}
		colorDraft = normalized;
		const now = new Date().toISOString();
		setCurrentBoardButtons(
			buttons.map((b) =>
				b.id === button.id
					? {
							...b,
							background_color: normalized,
							palette_color_id: null,
							updated_at: now
						}
					: b
			)
		);
	}

	function selectNoneColor() {
		const button = selectedButton;
		if (!button) return;
		if (button.background_color === null && button.palette_color_id === null) return;
		propsError = null;
		colorDraft = DEFAULT_BUTTON_COLOR;
		const now = new Date().toISOString();
		setCurrentBoardButtons(
			buttons.map((b) =>
				b.id === button.id
					? { ...b, background_color: null, palette_color_id: null, updated_at: now }
					: b
			)
		);
	}

	function selectPaletteColor(paletteColorId: string) {
		const button = selectedButton;
		if (!button) return;
		const color = paletteColors.find((c) => c.id === paletteColorId);
		if (!color) return;
		propsError = null;
		if (button.palette_color_id === paletteColorId) {
			colorDraft = color.hex;
			return;
		}
		colorDraft = color.hex;
		const now = new Date().toISOString();
		setCurrentBoardButtons(
			buttons.map((b) =>
				b.id === button.id
					? {
							...b,
							background_color: null,
							palette_color_id: paletteColorId,
							updated_at: now
						}
					: b
			)
		);
	}


	function applyBoardSize() {
		const board = selectedBoard;
		if (!board) return;

		const width = Number(widthDraft);
		const height = Number(heightDraft);
		if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
			boardSizeError = 'Width and height must be integers ≥ 1.';
			widthDraft = board.width;
			heightDraft = board.height;
			return;
		}

		if (width === board.width && height === board.height) return;

		boardSizeError = null;
		const now = new Date().toISOString();
		setBoards(
			boards.map((b) => (b.id === board.id ? { ...b, width, height, updated_at: now } : b))
		);
		widthDraft = width;
		heightDraft = height;
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
			panFromBackground = false;
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
		const shouldClearSelection = panFromBackground && !didPan;
		isPanning = false;
		panPointerId = null;
		panFromBackground = false;
		if (shouldClearSelection) {
			selection = null;
		}
		queueMicrotask(() => {
			didPan = false;
		});
	}

	function onBackgroundPointerDown(event: PointerEvent) {
		if (event.button !== 0 || spaceDown) return;
		isPanning = true;
		didPan = false;
		panFromBackground = true;
		panPointerId = event.pointerId;
		panOrigin = { x: event.clientX, y: event.clientY, panX, panY };
		canvasEl?.setPointerCapture(event.pointerId);
	}
</script>

<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
	<div>
		<div class="relative z-20 flex items-center justify-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
		{#if loadingBoards}
			<p class="text-sm text-slate-500">Loading…</p>
		{:else}
			{#if destinationBoards.length === 0 && snippets.length === 0}
				<button
					type="button"
					class="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
					onclick={() => openCreate('board')}
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
							<span class="truncate"
								>{selectedBoard ? selectedBoard.displayName : 'Select'}</span
							>
							<span class="text-slate-400" aria-hidden="true">{open ? '▴' : '▾'}</span>
						</button>
					{/snippet}
					{#snippet children({ close })}
						<div class="max-h-80 min-w-56 overflow-y-auto py-1">
							<p
								class="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase"
							>
								Boards
							</p>
							{#if destinationBoards.length === 0}
								<p class="px-3 py-1.5 text-sm text-slate-500">No boards yet</p>
							{:else}
								{#each destinationBoards as board (board.id)}
									<button
										type="button"
										class="flex w-full items-center px-3 py-2 text-left text-sm transition {board.id ===
										selectedBoardId
											? 'bg-blue-50 font-medium text-blue-800'
											: 'text-slate-700 hover:bg-slate-50'}"
										onclick={() => {
											setSelectedBoardId(board.id);
											fittedBoardId = null;
											close();
										}}
									>
										{board.displayName}
									</button>
								{/each}
							{/if}
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-sm font-medium text-blue-700 transition hover:bg-blue-50"
								onclick={() => {
									close();
									openCreate('board');
								}}
							>
								+ New board
							</button>
							<div class="my-1 border-t border-slate-200"></div>
							<p
								class="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase"
							>
								Snippets
							</p>
							{#if snippets.length === 0}
								<p class="px-3 py-1.5 text-sm text-slate-500">No snippets yet</p>
							{:else}
								{#each snippets as snippet (snippet.id)}
									<button
										type="button"
										class="flex w-full items-center px-3 py-2 text-left text-sm transition {snippet.id ===
										selectedBoardId
											? 'bg-blue-50 font-medium text-blue-800'
											: 'text-slate-700 hover:bg-slate-50'}"
										onclick={() => {
											setSelectedBoardId(snippet.id);
											fittedBoardId = null;
											close();
										}}
									>
										{snippet.displayName}
									</button>
								{/each}
							{/if}
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-sm font-medium text-blue-700 transition hover:bg-blue-50"
								onclick={() => {
									close();
									openCreate('snippet');
								}}
							>
								+ New snippet
							</button>
						</div>
					{/snippet}
				</Menu>
			{/if}

			{#if selectedBoard}
			<Menu>
				{#snippet trigger({ toggle })}
					<button
						type="button"
						class="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
						aria-label={isSnippet(selectedBoard) ? 'Snippet options' : 'Board options'}
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
						Rename {selectedGridNoun}
					</button>
					<button
						type="button"
						class="block w-full px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
						onclick={() => {
							close();
							openDelete();
						}}
					>
						Delete {selectedGridNoun}
					</button>
				{/snippet}
			</Menu>
			{/if}
		{/if}
		</div>
		{#if error}
			<p class="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{/if}
	</div>

	{#if selectedBoard}
		<div class="grid h-full min-h-0 grid-cols-[1fr_18rem] grid-rows-[minmax(0,1fr)]">
			<!-- Canvas -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={canvasEl}
				role="application"
				aria-label={selectedBoard && isSnippet(selectedBoard) ? 'Snippet canvas' : 'Board canvas'}
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
						class="pointer-events-auto relative overflow-visible rounded-2xl border border-slate-300 bg-white p-3 shadow-xl"
						style={`width: ${boardContentWidth + 24}px; height: ${boardContentHeight + 24}px;`}
						onclick={(event) => {
							event.stopPropagation();
							clearSelection();
						}}
					>
						<div
							class="relative"
							style={`width: ${boardContentWidth}px; height: ${boardContentHeight}px;`}
						>
							{#if selectedBoard}
								{#each Array.from({ length: selectedBoard.width }, (_, col) => col) as col (col)}
									<div
										class="pointer-events-none absolute flex items-end justify-center pb-1 text-xs font-semibold text-slate-500"
										style={`left: ${LABEL_GUTTER + cellLeft(col)}px; top: 0; width: ${CELL}px; height: ${LABEL_GUTTER}px;`}
										aria-hidden="true"
									>
										{columnLetter(col)}
									</div>
								{/each}
								{#each Array.from({ length: selectedBoard.height }, (_, row) => row) as row (row)}
									<div
										class="pointer-events-none absolute flex items-center justify-end pr-1.5 text-xs font-semibold text-slate-500"
										style={`left: 0; top: ${LABEL_GUTTER + cellTop(row)}px; width: ${LABEL_GUTTER}px; height: ${CELL}px;`}
										aria-hidden="true"
									>
										{rowNumber(row)}
									</div>
								{/each}
							{/if}

							<div
								class="absolute overflow-visible"
								style={`left: ${LABEL_GUTTER}px; top: ${LABEL_GUTTER}px; width: ${boardPixelWidth}px; height: ${boardPixelHeight}px;`}
							>
							{#each viewportCells as cell (`${cell.row}:${cell.col}`)}
								{@const occupying = buttonAtCell.get(`${cell.row}:${cell.col}`)}
								{@const isDragOrigin =
									drag?.active &&
									drag.kind === 'button' &&
									occupying &&
									drag.id === occupying.id}
								{@const coveringInclusion = newestInclusionAt(cell.row, cell.col)}
								<button
									type="button"
									class="group absolute flex items-center justify-center rounded-lg bg-slate-200/90 {coveringInclusion
										? ''
										: 'hover:bg-slate-300 active:bg-slate-400'}"
									style={`left: ${cellLeft(cell.col)}px; top: ${cellTop(cell.row)}px; width: ${CELL}px; height: ${CELL}px;`}
									aria-label={`Empty cell ${cellRef(cell.row, cell.col)}`}
									disabled={Boolean(occupying && !isDragOrigin) ||
										Boolean(drag?.active)}
									onclick={(event) => {
										event.stopPropagation();
										if (occupying && !isDragOrigin) return;
										if (selection) {
											clearSelection();
											return;
										}
										if (coveringInclusion) {
											selectInclusion(coveringInclusion, event);
											return;
										}
										createButtonAt(cell.row, cell.col, event);
									}}
									oncontextmenu={(event) =>
										onEmptyCellContextMenu(cell.row, cell.col, event)}
								>
									{#if !coveringInclusion}
										<span
											class="pointer-events-none select-none text-3xl font-light leading-none text-slate-500 opacity-0 group-hover:opacity-50"
											aria-hidden="true"
										>
											+
										</span>
									{/if}
								</button>
							{/each}

							{#each hostInclusions as inc, paintOrder (inc.id)}
								{@const rect = inclusionRect(inc)}
								{@const snippet = snippetForInclusion(inc)}
								{@const innerButtons = mappedButtonsInInclusion(
									inc.snippet_id,
									inc.origin_row,
									inc.origin_col
								)}
								{@const isDraggingInclusion =
									drag?.active && drag.kind === 'inclusion' && drag.id === inc.id}
								{@const layerLeft =
									isDraggingInclusion && drag ? drag.floatX : cellLeft(inc.origin_col)}
								{@const layerTop =
									isDraggingInclusion && drag ? drag.floatY : cellTop(inc.origin_row)}
								{#if rect && snippet}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="absolute rounded-lg bg-slate-500/25 {isSelected(
											'inclusion',
											inc.id
										)
											? 'cursor-grab ring-2 ring-blue-500 ring-offset-1'
											: 'cursor-grab'} {isDraggingInclusion
											? 'cursor-grabbing shadow-lg ring-2 ring-blue-500/40'
											: ''}"
										style={`left: ${layerLeft}px; top: ${layerTop}px; width: ${cellSpanSize(rect.width)}px; height: ${cellSpanSize(rect.height)}px; z-index: ${isDraggingInclusion ? 1010 : 1 + paintOrder};`}
										role="button"
										tabindex="0"
										aria-label={`Snippet inclusion ${snippet.displayName} at ${cellRef(inc.origin_row, inc.origin_col)}`}
										onpointerdown={(event) => onInclusionPointerDown(inc, event)}
										onpointermove={onItemPointerMove}
										onpointerup={onItemPointerUp}
										onpointercancel={onItemPointerUp}
										onclick={(event) => selectInclusion(inc, event)}
										ondblclick={(event) => {
											event.stopPropagation();
											openSnippetCanvas(inc.snippet_id);
										}}
									>
										{#each innerButtons as mapped (`${mapped.button.id}:${mapped.hostRow}:${mapped.hostCol}`)}
											<div
												class="pointer-events-none absolute flex items-center justify-center overflow-hidden rounded-lg border border-slate-300/80 px-2 text-center text-sm font-medium opacity-40"
												style={`left: ${cellLeft(mapped.hostCol) - cellLeft(inc.origin_col)}px; top: ${cellTop(mapped.hostRow) - cellTop(inc.origin_row)}px; width: ${CELL}px; height: ${CELL}px; background-color: ${resolveButtonHex(mapped.button)}; color: ${contrastingTextColor(resolveButtonHex(mapped.button))};`}
											>
												<span class="line-clamp-3 break-words">{mapped.button.label}</span>
											</div>
										{/each}
									</div>
								{/if}
							{/each}

							{#if drag?.active}
								{@const preview = dragPreviewRect(drag)}
								{@const dropBlocked =
									drag.kind === 'button' &&
									dropTargetBlocked(drag.currentRow, drag.currentCol, drag.id)}
								<div
									class="pointer-events-none absolute z-[1005] rounded-lg {dropBlocked
										? ''
										: 'bg-slate-700/25'}"
									style={`left: ${cellLeft(preview.col)}px; top: ${cellTop(preview.row)}px; width: ${cellSpanSize(preview.width)}px; height: ${cellSpanSize(preview.height)}px;${
										dropBlocked
											? ' background-image: repeating-linear-gradient(-45deg, rgb(239 68 68 / 0.55), rgb(239 68 68 / 0.55) 5px, rgb(251 146 160 / 0.55) 5px, rgb(251 146 160 / 0.55) 10px);'
											: ''
									}`}
								></div>
							{/if}

							{#each buttons as button (button.id)}
								{@const inViewport =
									selectedBoard &&
									button.row_index >= 0 &&
									button.col_index >= 0 &&
									button.row_index < selectedBoard.height &&
									button.col_index < selectedBoard.width}
								{@const isDragging = Boolean(
									drag?.active && drag.kind === 'button' && drag.id === button.id
								)}
								{@const buttonLeft = isDragging && drag
									? drag.floatX
									: cellLeft(button.col_index)}
								{@const buttonTop = isDragging && drag
									? drag.floatY
									: cellTop(button.row_index)}
								<button
									type="button"
									class="absolute z-[1000] flex items-center justify-center overflow-hidden rounded-lg border px-2 text-center text-sm font-medium {isDragging
										? 'z-[1010] cursor-grabbing border-blue-500 shadow-lg ring-2 ring-blue-500/40'
										: isSelected('button', button.id)
											? 'z-[1001] cursor-grab border-blue-500 shadow-sm ring-2 ring-blue-500/40 transition'
											: inViewport
												? 'cursor-grab border-slate-300 shadow-sm transition hover:border-slate-400'
												: 'cursor-grab border-amber-300 shadow-sm transition hover:border-amber-400'}"
									style={`left: ${buttonLeft}px; top: ${buttonTop}px; width: ${CELL}px; height: ${CELL}px; background-color: ${resolveButtonHex(button)}; color: ${contrastingTextColor(resolveButtonHex(button))};`}
									aria-label={`${button.label.trim() || 'Untitled button'} at ${cellRef(button.row_index, button.col_index)}`}
									onpointerdown={(event) => onButtonPointerDown(button, event)}
									onpointermove={onItemPointerMove}
									onpointerup={onItemPointerUp}
									onpointercancel={onItemPointerUp}
									onclick={(event) => selectButton(button, event)}
								>
									<span class="line-clamp-3 break-words pointer-events-none">
										{button.label}
									</span>
								</button>
							{/each}
							</div>
						</div>
					</div>
				</div>

				{#if isBoardOffscreen}
					<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
						<button
							type="button"
							class="pointer-events-auto rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
							onclick={fitBoardInView}
						>
							Re-center board
						</button>
					</div>
				{/if}

				<div
					class="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-500 shadow-sm"
				>
					{Math.round(zoom * 100)}% · Scroll to pan · ⌘/Ctrl+scroll to zoom · Drag buttons to move
				</div>
			</div>

			<!-- Properties sidebar -->
			<aside class="flex min-h-0 flex-col border-l border-slate-200 bg-white">
				<div class="border-b border-slate-100 px-4 py-3">
					<h2 class="text-sm font-semibold text-slate-900">
						{selectedButton
							? 'Button'
							: selectedInclusion
								? 'Snippet inclusion'
								: selectedGridNoun === 'snippet'
									? 'Snippet'
									: 'Board'}
					</h2>
				</div>

				{#if selectedButton}
					<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
						<label class="block space-y-1.5">
							<span class="text-xs font-medium tracking-wide text-slate-500 uppercase">
								Label
							</span>
							<input
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								type="text"
								bind:value={labelDraft}
								oninput={() => updateSelectedLabel()}
							/>
						</label>

						<div class="space-y-2">
							<span class="text-xs font-medium tracking-wide text-slate-500 uppercase"
								>Background</span
							>
							<div class="grid grid-cols-5 gap-2">
								<button
									type="button"
									class="relative aspect-square rounded-lg border shadow-sm transition hover:scale-105 {selectedButton.background_color ===
										null && selectedButton.palette_color_id === null
										? 'border-blue-500 ring-2 ring-blue-500/40'
										: 'border-slate-300'}"
									style="background-color: #ffffff;"
									title="None"
									aria-label="None"
									aria-pressed={selectedButton.background_color === null &&
										selectedButton.palette_color_id === null}
									onclick={selectNoneColor}
								>
									<span
										class="pointer-events-none absolute inset-1 rounded-full border-2 border-slate-400"
										aria-hidden="true"
									></span>
									<span
										class="pointer-events-none absolute top-1/2 left-1/2 h-0.5 w-[120%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-400"
										aria-hidden="true"
									></span>
								</button>
								{#each [...paletteColors].sort((a, b) => a.position - b.position) as swatch (swatch.id)}
									<button
										type="button"
										class="aspect-square rounded-lg border shadow-sm transition hover:scale-105 {selectedButton.palette_color_id ===
										swatch.id
											? 'border-blue-500 ring-2 ring-blue-500/40'
											: 'border-slate-300'}"
										style={`background-color: ${swatch.hex};`}
										title={swatch.name.trim()
											? `${swatch.name}${swatch.description ? ` — ${swatch.description}` : ''}`
											: swatch.hex}
										aria-label={swatch.name.trim() || swatch.hex}
										aria-pressed={selectedButton.palette_color_id === swatch.id}
										onclick={() => selectPaletteColor(swatch.id)}
									></button>
								{/each}
							</div>
							<label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
								<span class="text-sm text-slate-600">Custom</span>
								<input
									class="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
									type="color"
									bind:value={colorDraft}
									oninput={() => updateSelectedColor(colorDraft)}
								/>
								<span class="font-mono text-xs text-slate-500">{colorDraft}</span>
							</label>
							<a
								href={`/vocabularies/${vocabularyId}/settings`}
								class="inline-block text-sm font-medium text-blue-700 hover:underline"
							>
								Customize vocabulary palette
							</a>
						</div>

						<ButtonActionEditor
							buttonId={selectedButton.id}
							action={selectedButton.action ?? null}
							label={selectedButton.label}
							boards={destinationBoards}
							currentBoardId={selectedBoardId}
							onChange={updateSelectedAction}
						/>

						{#if propsError}
							<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{propsError}</p>
						{/if}

						<div class="mt-auto border-t border-slate-100 pt-4">
							<button
								type="button"
								class="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
								onclick={deleteSelectedButton}
							>
								Delete button
							</button>
						</div>
					</div>
				{:else if selectedInclusion}
					<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
						<p class="text-sm text-slate-700">
							{selectedInclusionSnippet?.displayName ?? 'Untitled snippet'} at
							{cellRef(selectedInclusion.origin_row, selectedInclusion.origin_col)}
						</p>
						<p class="text-sm text-slate-500">
							Inner buttons are edited on the snippet canvas.
						</p>
						<button
							type="button"
							class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
							onclick={() => openSnippetCanvas(selectedInclusion.snippet_id)}
						>
							Edit snippet
						</button>
						<div class="mt-auto border-t border-slate-100 pt-4">
							<button
								type="button"
								class="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
								onclick={deleteSelectedInclusion}
							>
								Remove inclusion
							</button>
						</div>
					</div>
				{:else if selectedBoard}
					<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
						<div class="grid grid-cols-2 gap-3">
							<label class="block space-y-1.5">
								<span class="text-xs font-medium tracking-wide text-slate-500 uppercase">
									Width
								</span>
								<input
									class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
									type="number"
									min="1"
									step="1"
									bind:value={widthDraft}
									onblur={applyBoardSize}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											(event.currentTarget as HTMLInputElement).blur();
										}
									}}
								/>
							</label>
							<label class="block space-y-1.5">
								<span class="text-xs font-medium tracking-wide text-slate-500 uppercase"
									>Height</span
								>
								<input
									class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
									type="number"
									min="1"
									step="1"
									bind:value={heightDraft}
									onblur={applyBoardSize}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											(event.currentTarget as HTMLInputElement).blur();
										}
									}}
								/>
							</label>
						</div>

						{#if boardSizeError}
							<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{boardSizeError}</p>
						{/if}
					</div>
				{:else}
					<div class="flex flex-1 items-center justify-center p-6">
						<p class="text-center text-sm text-slate-500">Select a board or snippet to edit.</p>
					</div>
				{/if}
			</aside>
		</div>
	{:else if !loadingBoards}
		<div class="flex min-h-0 items-center justify-center p-8">
			<p class="text-sm text-slate-500">Create a board or snippet to start editing.</p>
		</div>
	{/if}

</div>

{#if cellMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40"
		onclick={() => {
			cellMenu = null;
		}}
		oncontextmenu={(event) => {
			event.preventDefault();
			cellMenu = null;
		}}
	></div>
	<div
		class="fixed z-50 min-w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
		style={`left: ${cellMenu.x}px; top: ${cellMenu.y}px;`}
		role="menu"
	>
		<button
			type="button"
			class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
			role="menuitem"
			onclick={() => {
				if (!cellMenu) return;
				const { row, col } = cellMenu;
				cellMenu = null;
				createButtonAt(row, col);
			}}
		>
			Add button
		</button>
		{#if selectedBoard}
			<button
				type="button"
				class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
				role="menuitem"
				onclick={() => {
					if (!cellMenu) return;
					openInsertSnippet(cellMenu.row, cellMenu.col);
				}}
			>
				Insert snippet
			</button>
		{/if}
	</div>
{/if}

<Modal bind:open={createOpen} title={createKind === 'snippet' ? 'New snippet' : 'New board'}>
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
		<div class="grid grid-cols-2 gap-3">
			<label class="block space-y-1.5">
				<span class="text-sm font-medium text-slate-700">Width</span>
				<input
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					type="number"
					min="1"
					step="1"
					bind:value={newBoardWidth}
				/>
			</label>
			<label class="block space-y-1.5">
				<span class="text-sm font-medium text-slate-700">Height</span>
				<input
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					type="number"
					min="1"
					step="1"
					bind:value={newBoardHeight}
				/>
			</label>
		</div>
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
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
		>
			Create
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={insertSnippetOpen}
	title="Insert snippet"
	onClose={() => {
		insertSnippetCell = null;
	}}
>
	{#if snippets.length === 0}
		<p class="text-sm text-slate-600">
			Create a snippet first, then insert it on this {selectedGridNoun}.
		</p>
	{:else if insertableSnippets.length === 0}
		<p class="text-sm text-slate-600">
			No other Snippet can be included here without creating a cycle.
		</p>
	{:else}
		<div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
			{#each insertableSnippets as snippet (snippet.id)}
				<button
					type="button"
					class="rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
					onclick={() => {
						if (!insertSnippetCell) return;
						insertSnippetAt(snippet.id, insertSnippetCell.row, insertSnippetCell.col);
					}}
				>
					{snippet.displayName}
				</button>
			{/each}
		</div>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			onclick={() => {
				insertSnippetOpen = false;
				insertSnippetCell = null;
			}}
		>
			Cancel
		</button>
	{/snippet}
</Modal>

<Modal bind:open={renameOpen} title={selectedGridNoun === 'snippet' ? 'Rename snippet' : 'Rename board'}>
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
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
		>
			Save
		</button>
	{/snippet}
</Modal>

<Modal bind:open={deleteOpen} title={selectedGridNoun === 'snippet' ? 'Delete snippet' : 'Delete board'}>
	<div class="space-y-3">
		<p class="text-sm text-slate-600">
			Delete {selectedGridNoun} “{selectedBoard?.displayName ?? 'Untitled'}”? This cannot be undone.
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
		>
			Cancel
		</button>
		<button
			type="button"
			class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
			onclick={deleteBoard}
		>
			Delete
		</button>
	{/snippet}
</Modal>
