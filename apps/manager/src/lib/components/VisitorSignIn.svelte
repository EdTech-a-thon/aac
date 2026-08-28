<script lang="ts">
	import { apiFetch, writeAuth, type AuthUser } from '$lib/auth';

	let { onauthed }: { onauthed: () => void } = $props();

	let mode = $state<'login' | 'register'>('login');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let message = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		message = null;
		try {
			const data = await apiFetch<{
				user?: AuthUser;
				session?: { access_token: string; refresh_token: string; expires_at?: number };
				message?: string;
			}>(mode === 'login' ? '/auth/login' : '/auth/register', {
				method: 'POST',
				body: JSON.stringify(
					mode === 'register'
						? { name, email, password, emailRedirectTo: window.location.href }
						: { email, password }
				)
			});

			if (data.user && data.session) {
				writeAuth({ user: data.user, session: data.session });
				onauthed();
				return;
			}
			// Registration can come back without a session when email
			// confirmation is on. Stay here — the Visitor's edits are on this
			// page and must not be navigated away from. See ADR 0011.
			message = data.message ?? 'Check your email, then come back to this page and save.';
			password = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not sign in';
		} finally {
			busy = false;
		}
	}
</script>

<form class="space-y-3" onsubmit={submit}>
	<p class="text-sm text-slate-600">
		{mode === 'login'
			? 'Sign in and this becomes a vocabulary in your account, with your changes.'
			: 'Create an account and this becomes your own vocabulary, with your changes.'}
	</p>
	{#if error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
	{/if}
	{#if message}
		<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
	{/if}
	{#if mode === 'register'}
		<input
			class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
			type="text"
			placeholder="Your name"
			bind:value={name}
		/>
	{/if}
	<input
		class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
		type="email"
		placeholder="Email"
		required
		bind:value={email}
	/>
	<input
		class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
		type="password"
		placeholder="Password"
		required
		bind:value={password}
	/>
	<div class="flex items-center justify-between gap-3">
		<button
			type="button"
			class="text-sm text-blue-700 underline-offset-2 hover:underline"
			onclick={() => {
				mode = mode === 'login' ? 'register' : 'login';
				error = null;
				message = null;
			}}
		>
			{mode === 'login' ? 'I need an account' : 'I already have an account'}
		</button>
		<button
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
			type="submit"
			disabled={busy}
		>
			{busy ? 'Working…' : mode === 'login' ? 'Sign in and save' : 'Create account and save'}
		</button>
	</div>
</form>
