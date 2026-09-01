<script lang="ts">
	import VoiceCommonsBrand from '$lib/components/VoiceCommonsBrand.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
</script>

<svelte:head>
	<title>About — VoiceCommons</title>
	<meta
		name="description"
		content="VoiceCommons is a free, open-source AAC project from the EdTech-a-thon."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-50 text-slate-900">
	<header class="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-6">
		<a class="no-underline" href="/" aria-label="VoiceCommons home">
			<VoiceCommonsBrand compact />
		</a>
		<a class="text-sm text-slate-500 hover:text-blue-700" href="/">← Back to VoiceCommons</a>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
		<h1 class="mb-2 text-2xl font-bold">About</h1>
		<p class="mb-6 text-sm text-slate-600">
			A free, open-source AAC app for communicators, the families who support them, and the
			professionals who work with them.
		</p>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<div class="mb-2 flex items-center gap-3">
				<img src="/edtechathon/logo.svg" alt="" class="h-10 w-10 shrink-0" />
				<h2 class="text-lg font-semibold">From the EdTech-a-thon</h2>
			</div>
			<p class="text-sm leading-relaxed text-slate-700">
				VoiceCommons is a project from the
				<a
					href="https://edtechathon.com"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-blue-700 underline-offset-4 hover:underline">EdTech-a-thon</a
				>, a community of builders making free tools for classrooms. Learn more about who we are and
				what else we're building at
				<a
					href="https://edtechathon.com"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-blue-700 underline-offset-4 hover:underline">edtechathon.com</a
				>.
			</p>

			<figure
				class="mx-auto mt-6 w-full max-w-lg -rotate-1 rounded-sm bg-white p-3 pb-6 shadow-lg ring-1 ring-slate-200"
			>
				<img
					src="/edtechathon/participants-2026.jpg"
					alt="Participants of the 2026 EdTech-a-thon"
					class="w-full bg-slate-100"
				/>
				<figcaption class="handwriting pt-5 text-center text-lg text-slate-700">
					EdTech-a-thon 2026
				</figcaption>
			</figure>
		</section>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">Our promise</h2>
			<ul class="space-y-2 text-sm leading-relaxed text-slate-700">
				<li><span class="font-semibold">Zero paywalls.</span></li>
				<li><span class="font-semibold">Zero ads.</span></li>
				<li><span class="font-semibold">Zero selling of your data.</span></li>
			</ul>
		</section>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">Feedback &amp; ideas</h2>
			<p class="mb-3 text-sm leading-relaxed text-slate-700">
				We'd love to hear from you. Tell us what's working, what's not, or pitch us an idea for a
				tool you wish existed. We're here to help.
			</p>
			<a
				href="mailto:support@voicecommons.com?subject=voicecommons%20feedback"
				class="inline-block rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 ring-1 ring-slate-800 hover:bg-slate-700"
			>
				Email support@voicecommons.com
			</a>
		</section>
	</main>

	<SiteFooter />
</div>

<style>
	.handwriting {
		font-family: 'Segoe Script', 'Bradley Hand', 'Snell Roundhand', 'Comic Sans MS', cursive;
	}
</style>
