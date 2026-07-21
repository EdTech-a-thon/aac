<script lang="ts">
	import { PUBLIC_API_URL } from '$env/static/public';
	import { onMount } from 'svelte';

	type Mode = 'login' | 'register';

	type AuthUser = {
		id: string;
		email: string | null;
	};

	const storageKey = 'manager-auth';

	let mode = $state<Mode>('login');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let user = $state<AuthUser | null>(null);
	let message = $state<string | null>(null);

	onMount(() => {
		const stored = localStorage.getItem(storageKey);
		if (!stored) return;

		try {
			const parsed = JSON.parse(stored) as { user?: AuthUser };
			if (parsed.user) user = parsed.user;
		} catch {
			localStorage.removeItem(storageKey);
		}
	});

	function signOut() {
		localStorage.removeItem(storageKey);
		user = null;
		message = null;
		error = null;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		error = null;
		message = null;

		const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';

		try {
			const response = await fetch(`${PUBLIC_API_URL}${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error ?? 'Something went wrong');
			}

			if (data.user) {
				user = data.user;
				localStorage.setItem(storageKey, JSON.stringify(data));
			}

			if (data.message) {
				message = data.message;
			}

			password = '';
		} catch (err) {
			user = null;
			localStorage.removeItem(storageKey);
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<main class="min-h-screen flex items-center justify-center p-4">
	{#if user}
		<section class="w-full max-w-sm space-y-4 text-center">
			<p>Signed in as {user.email ?? 'User'}</p>
			<button type="button" class="border px-4 py-2" onclick={signOut}>Sign out</button>
		</section>
	{:else}
		<form class="w-full max-w-sm space-y-4 border p-6" onsubmit={submit}>
			<div class="flex gap-2">
				<button
					type="button"
					class="flex-1 border px-3 py-2"
					class:font-semibold={mode === 'login'}
					onclick={() => (mode = 'login')}
				>
					Login
				</button>
				<button
					type="button"
					class="flex-1 border px-3 py-2"
					class:font-semibold={mode === 'register'}
					onclick={() => (mode = 'register')}
				>
					Register
				</button>
			</div>

			<label class="block space-y-1">
				<span>Email</span>
				<input
					class="w-full border px-3 py-2"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
				/>
			</label>

			<label class="block space-y-1">
				<span>Password</span>
				<input
					class="w-full border px-3 py-2"
					type="password"
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					required
					bind:value={password}
				/>
			</label>

			<button class="w-full border px-4 py-2" type="submit" disabled={loading}>
				{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
			</button>

			{#if message}
				<p class="text-sm">{message}</p>
			{/if}

			{#if error}
				<p class="text-sm">{error}</p>
			{/if}
		</form>
	{/if}
</main>
