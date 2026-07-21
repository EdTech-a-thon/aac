<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		apiFetch,
		clearAuth,
		readAuth,
		writeAuth,
		type AuthUser
	} from '$lib/auth';

	type Mode = 'login' | 'register';

	let mode = $state<Mode>('login');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let message = $state<string | null>(null);
	let checking = $state(true);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('emailConfirmed') === '1') {
			clearAuth();
			mode = 'login';
			message = 'Email confirmed. Please sign in.';
			window.history.replaceState({}, '', window.location.pathname);
			checking = false;
			return;
		}

		const auth = readAuth();
		if (auth) {
			goto('/vocabularies');
			return;
		}

		checking = false;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		error = null;
		message = null;

		const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';

		try {
			const data = await apiFetch<{
				user?: AuthUser;
				session?: {
					access_token: string;
					refresh_token: string;
					expires_at?: number;
				};
				message?: string;
			}>(endpoint, {
				method: 'POST',
				body: JSON.stringify(
					mode === 'register'
						? {
								name,
								email,
								password,
								emailRedirectTo: `${window.location.origin}/?emailConfirmed=1`
							}
						: { email, password }
				)
			});

			if (data.user && data.session) {
				writeAuth({ user: data.user, session: data.session });
				await goto('/vocabularies');
				return;
			}

			if (data.message) {
				message = data.message;
			}

			password = '';
			if (mode === 'register') name = '';
		} catch (err) {
			clearAuth();
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<main class="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-slate-100 p-4">
	{#if checking}
		<p class="text-sm text-slate-500">Loading…</p>
	{:else}
		<div class="w-full max-w-sm">
			<div class="mb-8 text-center">
				<p class="text-sm font-semibold tracking-wide text-blue-600 uppercase">AAC Manager</p>
				<h1 class="mt-1 text-2xl font-semibold text-slate-900">
					{mode === 'login' ? 'Welcome back' : 'Create your account'}
				</h1>
			</div>

			<form
				class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
				onsubmit={submit}
			>
				<div class="flex rounded-lg bg-slate-100 p-1">
					<button
						type="button"
						class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {mode ===
						'login'
							? 'bg-white text-slate-900 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => (mode = 'login')}
					>
						Login
					</button>
					<button
						type="button"
						class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {mode ===
						'register'
							? 'bg-white text-slate-900 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => (mode = 'register')}
					>
						Register
					</button>
				</div>

				{#if mode === 'register'}
					<label class="block space-y-1.5">
						<span class="text-sm font-medium text-slate-700">Name</span>
						<input
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
							type="text"
							autocomplete="name"
							required
							bind:value={name}
						/>
					</label>
				{/if}

				<label class="block space-y-1.5">
					<span class="text-sm font-medium text-slate-700">Email</span>
					<input
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
					/>
				</label>

				<label class="block space-y-1.5">
					<span class="text-sm font-medium text-slate-700">Password</span>
					<input
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						type="password"
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
						required
						bind:value={password}
					/>
				</label>

				<button
					class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
					type="submit"
					disabled={loading}
				>
					{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
				</button>

				{#if message}
					<p class="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>
				{/if}

				{#if error}
					<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
				{/if}
			</form>
		</div>
	{/if}
</main>
