<script lang="ts">
	import VoiceCommonsBrand from '$lib/components/VoiceCommonsBrand.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
</script>

<svelte:head>
	<title>Privacy — VoiceCommons</title>
	<meta
		name="description"
		content="What VoiceCommons collects, what it doesn't, and why."
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
		<h1 class="mb-2 text-2xl font-bold">Privacy</h1>
		<p class="mb-6 text-sm text-slate-600">What we collect, what we don't, and why.</p>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">The short version</h2>
			<p class="text-sm leading-relaxed text-slate-700">
				We do not show ads, and we do not share, sell, or otherwise transfer your data to third
				parties. We collect what it takes to keep an account signed in and to store the
				vocabularies you build — nothing beyond that.
			</p>
		</section>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">Your account</h2>
			<p class="text-sm leading-relaxed text-slate-700">
				Creating an account stores your name, your email address, and a password you choose. We use
				them to sign you in, to show collaborators who suggested a change, and to email you about
				your account. Sign-in and passwords are handled for us by
				<a
					href="https://supabase.com/privacy"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-blue-700 underline-offset-4 hover:underline">Supabase</a
				>, our hosting provider for accounts and data. Your signed-in session is kept in your
				browser's local storage so that you stay signed in between visits.
			</p>
		</section>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">What you build</h2>
			<p class="text-sm leading-relaxed text-slate-700">
				Vocabularies, boards, buttons, and any symbols you upload are stored on our servers so that
				you and the people you invite can reach them from any device. They stay private to you and
				to the people you invite until you choose to share or publish them.
			</p>
			<p class="mt-4 text-sm leading-relaxed text-slate-700">
				Two things make a vocabulary reachable by other people, and both are deliberate acts:
			</p>
			<ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
				<li>
					<span class="font-semibold">A share link</span> lets anyone holding the link open a
					read-only copy. Edits a visitor makes stay in their own browser and never reach your
					vocabulary. You can revoke a share link at any time.
				</li>
				<li>
					<span class="font-semibold">Publishing to the Gallery</span> makes that vocabulary
					public to everyone, including its title, description, and symbols. The credit line shown
					beside it is text you type when you publish — your account name and email address are
					never shown. You can unpublish at any time.
				</li>
			</ul>
			<p class="mt-4 text-sm leading-relaxed text-slate-700">
				Because a vocabulary is often built around one person, please keep in mind that a title or
				button naming a communicator becomes public if you publish it. Anyone can report a published
				vocabulary; when they do, we receive the reason they gave along with what they reported so
				that we can review it.
			</p>
		</section>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">Analytics</h2>
			<p class="text-sm leading-relaxed text-slate-700">
				We use Cloudflare Web Analytics to anonymously count visits, which helps us understand how
				VoiceCommons is being used. Cloudflare Web Analytics is cookieless, does not fingerprint
				visitors, and does not track users across other sites. See Cloudflare's
				<a
					href="https://www.cloudflare.com/privacypolicy/"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-blue-700 underline-offset-4 hover:underline">privacy policy</a
				> for details.
			</p>
		</section>

		<section class="mb-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
			<h2 class="mb-2 text-lg font-semibold">Deleting your data</h2>
			<p class="text-sm leading-relaxed text-slate-700">
				You can delete a vocabulary, revoke a share link, or unpublish from the Gallery yourself at
				any time. To have your whole account and everything in it deleted, email us and we will take
				care of it.
			</p>
			<p class="mt-4 text-sm leading-relaxed text-slate-700">
				Questions or concerns? Email
				<a
					href="mailto:support@voicecommons.com?subject=voicecommons%20privacy"
					class="font-medium text-blue-700 underline-offset-4 hover:underline"
					>support@voicecommons.com</a
				>.
			</p>
		</section>
	</main>

	<SiteFooter />
</div>
