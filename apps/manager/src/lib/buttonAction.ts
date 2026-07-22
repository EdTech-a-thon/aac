/** Button Action kinds configured in the manager app (performed later in the AAC app). */
export type ButtonAction =
	| { kind: 'insert_phrase'; phrase: string }
	| { kind: 'speak_immediately'; phrase: string }
	| { kind: 'open_board'; board_id: string }
	| { kind: 'play_youtube_clip'; video_id: string; start: number; end: number }
	| { kind: 'clear_message_bar' }
	| { kind: 'backspace' };

export type ButtonActionKind = ButtonAction['kind'] | 'none';

export const BUTTON_ACTION_KIND_OPTIONS: {
	kind: ButtonActionKind;
	label: string;
}[] = [
	{ kind: 'none', label: 'No Action' },
	{ kind: 'insert_phrase', label: 'Insert Phrase' },
	{ kind: 'speak_immediately', label: 'Speak Immediately' },
	{ kind: 'open_board', label: 'Open Board' },
	{ kind: 'play_youtube_clip', label: 'Play YouTube Clip' },
	{ kind: 'clear_message_bar', label: 'Clear Message Bar' },
	{ kind: 'backspace', label: 'Backspace' }
];

export function actionKey(action: ButtonAction | null | undefined): string {
	if (!action) return '';
	return JSON.stringify(action);
}

export function actionsEqual(
	a: ButtonAction | null | undefined,
	b: ButtonAction | null | undefined
): boolean {
	return actionKey(a) === actionKey(b);
}

/** Extract a YouTube video id from a bare id or common watch/share/embed URLs. */
export function parseYouTubeVideoId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

	try {
		const url = new URL(trimmed);
		const host = url.hostname.replace(/^www\./, '');
		if (host === 'youtu.be') {
			const id = url.pathname.split('/').filter(Boolean)[0];
			return id && /^[\w-]{11}$/.test(id) ? id : null;
		}
		if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
			const v = url.searchParams.get('v');
			if (v && /^[\w-]{11}$/.test(v)) return v;
			const parts = url.pathname.split('/').filter(Boolean);
			if (
				(parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') &&
				parts[1] &&
				/^[\w-]{11}$/.test(parts[1])
			) {
				return parts[1];
			}
		}
	} catch {
		return null;
	}
	return null;
}

export function youtubeEmbedSrc(videoId: string, start: number, end: number): string {
	const params = new URLSearchParams({
		start: String(Math.max(0, start)),
		end: String(Math.max(0, end)),
		rel: '0'
	});
	return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Returns a persistable Action, or null for "no Action".
 * Returns undefined when the draft is incomplete/invalid (do not persist yet).
 */
export function finalizeButtonAction(
	kind: ButtonActionKind,
	draft: {
		phrase: string;
		boardId: string;
		videoInput: string;
		start: number;
		end: number;
	}
): ButtonAction | null | undefined {
	if (kind === 'none') return null;

	if (kind === 'insert_phrase' || kind === 'speak_immediately') {
		const phrase = draft.phrase.trim();
		if (!phrase) return undefined;
		return { kind, phrase };
	}

	if (kind === 'open_board') {
		if (!draft.boardId) return undefined;
		return { kind: 'open_board', board_id: draft.boardId };
	}

	if (kind === 'play_youtube_clip') {
		const videoId = parseYouTubeVideoId(draft.videoInput);
		if (!videoId) return undefined;
		if (
			!Number.isFinite(draft.start) ||
			!Number.isFinite(draft.end) ||
			draft.start < 0 ||
			draft.end <= draft.start
		) {
			return undefined;
		}
		return {
			kind: 'play_youtube_clip',
			video_id: videoId,
			start: draft.start,
			end: draft.end
		};
	}

	if (kind === 'clear_message_bar') return { kind: 'clear_message_bar' };
	if (kind === 'backspace') return { kind: 'backspace' };
	return undefined;
}
