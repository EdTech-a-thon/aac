<script lang="ts">
	// The VoiceCommons lockup: the Offset mark, plus the wordmark split by colour
	// and weight so `voice` sits back and `commons` carries the name.
	let {
		compact = false,
		light = false,
		label = 'VoiceCommons'
	}: { compact?: boolean; light?: boolean; label?: string } = $props();
</script>

<span class:compact class:light class="voicecommons-brand" role="img" aria-label={label}>
	<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
		<rect x="7" y="4" width="32" height="32" rx="8.5" fill="#2f7fc4" />
		<path d="M34 49 L46 49 L31 60.5 Z" fill="#e8792b" />
		<rect x="24" y="21" width="32" height="32" rx="8.5" fill="#e8792b" />
		<!-- The ground the two boards hold in common. It flips to paper on a dark
		     bar, which is otherwise the very colour sitting behind it. -->
		<path
			d="M39 21 V27.5 A8.5 8.5 0 0 1 30.5 36 H24 V29.5 A8.5 8.5 0 0 1 32.5 21 Z"
			fill="var(--vc-meet)"
		/>
	</svg>
	<span class="wordmark"><span class="voice">voice</span><span class="commons">commons</span></span>
</span>

<style>
	.voicecommons-brand {
		--vc-meet: #123c5e;
		--vc-voice: #2f7fc4;
		--vc-commons: #123c5e;

		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
		font-size: 1.6rem;
		font-optical-sizing: auto;
		letter-spacing: -0.035em;
		line-height: 1;
		color: var(--vc-commons);
	}

	.voicecommons-brand.light {
		--vc-meet: #edf2f6;
		--vc-voice: #7fb6e0;
		--vc-commons: #ffffff;
	}

	.voicecommons-brand svg {
		width: 2.75rem;
		height: 2.75rem;
		flex: none;
	}

	.wordmark {
		white-space: nowrap;
	}

	.voice {
		font-weight: 400;
		color: var(--vc-voice);
	}

	.commons {
		font-weight: 800;
		color: var(--vc-commons);
	}

	.voicecommons-brand.compact {
		gap: 0.45rem;
		font-size: 0.95rem;
	}

	.voicecommons-brand.compact svg {
		width: 1.65rem;
		height: 1.65rem;
	}
</style>
