<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiFetch, clearAuth, writeAuth, type AuthUser } from '$lib/auth';
	import VoiceCommonsBrand from '$lib/components/VoiceCommonsBrand.svelte';
	type Mode = 'login' | 'register';
	let mode = $state<Mode>('register');
	let name = $state(''), email = $state(''), password = $state('');
	let loading = $state(false), checking = $state(true);
	let error = $state<string | null>(null), message = $state<string | null>(null);
	const words = [
		['I','●','#f7d8e5'],['want','↗','#d8edc7'],['to go','➜','#d8edc7'],['outside','☀','#cce8f3'],
		['you','◆','#f7d8e5'],['like','♥','#d8edc7'],['more','+','#dae6f8'],['music','♫','#f6e3b8'],
		['yes','✓','#d8edc7'],['no','×','#f7d8e5'],['help','✦','#dae6f8'],['feelings','☺','#f6e3b8']
	];
	onMount(() => {
		const p = new URLSearchParams(location.search);
		if (p.get('emailConfirmed') === '1') {
			clearAuth(); mode = 'login'; message = 'Email confirmed. Please sign in.';
			history.replaceState({}, '', location.pathname); checking = false;
			requestAnimationFrame(() => document.querySelector('#join')?.scrollIntoView());
			return;
		}
		checking = false;
	});
	function openAuth(next: Mode) {
		mode = next; error = message = null;
		requestAnimationFrame(() => document.querySelector('#join')?.scrollIntoView({ behavior:'smooth' }));
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault(); loading = true; error = message = null;
		try {
			const data = await apiFetch<{ user?: AuthUser; session?: { access_token:string; refresh_token:string; expires_at?:number }; message?:string }>(
				mode === 'login' ? '/auth/login' : '/auth/register',
				{ method:'POST', body:JSON.stringify(mode === 'register'
					? { name, email, password, emailRedirectTo:`${location.origin}/?emailConfirmed=1` }
					: { email, password }) }
			);
			if (data.user && data.session) { writeAuth({ user:data.user, session:data.session }); await goto('/vocabularies'); return; }
			if (data.message) message = data.message;
			password = ''; if (mode === 'register') name = '';
		} catch (err) { clearAuth(); error = err instanceof Error ? err.message : 'Something went wrong'; }
		finally { loading = false; }
	}
</script>

<svelte:head>
	<title>VoiceCommons — Communication belongs to everyone</title>
	<meta name="description" content="The free, open-source AAC app built for communicators, families, and professionals." />
</svelte:head>

<main>
	<nav>
		<a class="brand" href="/" aria-label="VoiceCommons home"><VoiceCommonsBrand /></a>
		<div class="navlinks"><a href="#how">How it works</a><a href="/gallery">Community vocabularies</a><button onclick={() => openAuth('login')}>Sign in</button></div>
	</nav>

	<section class="hero">
		<div class="copy">
			<h1>Communication is a right.</h1>
			<p class="lede">VoiceCommons is the free and open-source AAC app.</p>
			<div class="actions"><button class="primary" onclick={() => openAuth('register')}>Build a vocabulary</button><a href="/gallery">Explore community vocabularies</a></div>
			<small>No paid features. No ads. No nonsense.</small>
		</div>
		<div class="scene" aria-label="Preview of a VoiceCommons communication board">
			<div class="circle"></div>
			<div class="board">
				<header><b><VoiceCommonsBrand compact /></b><span class="person"><i>AM</i> Alex’s voice</span></header>
				<div class="message">I want to go outside <button>▶ Speak</button></div>
				<div class="grid">{#each words as word}<div class="word" style:background={word[2]}><b>{word[0]}</b><span>{word[1]}</span></div>{/each}</div>
			</div>
		</div>
	</section>

	<section class="manifesto">
		<h2>Communication shouldn't be a luxury.</h2>
		<p>Many AAC tools cost hundreds of dollars, lock essential features behind subscriptions, or make families choose between access and affordability. We think that's absurd. VoiceCommons is built in the open, free for everyone, and shaped by the people who actually use it.</p>
		<div class="values"><span><b>✓</b> Free forever</span><span><b>✓</b> Open source</span><span><b>✓</b> No ads or selling of data</span></div>
	</section>

	<section class="features" id="how">
		<article class="feature mint">
			<div class="featurecopy"><p class="kicker">Built for support teams</p><h2>Everyone can help.<br /><em>The right people approve.</em></h2><p>Parents and caregivers can suggest words, symbols, and board changes. SLPs and other Managers review each suggestion before it becomes part of the communicator’s voice.</p><div class="flow"><span>Parent suggests</span> → <span>SLP reviews</span> → <span>Voice grows</span></div></div>
			<div class="approval">
				<header><div><i>JP</i><p><b>Jamie P.</b><small>Parent · 12 minutes ago</small></p></div><span>Pending review</span></header>
				<blockquote>“Alex has been asking to visit the garden more often.”</blockquote>
				<div class="change"><div><b>garden</b><span>♧</span></div><p><small>NEW BUTTON</small><b>Add “garden” to Places</b><span>Row 2 · Column 4</span></p></div>
				<footer><button>Discuss</button><button>✓ Approve change</button></footer>
			</div>
		</article>
		<article class="feature peach">
			<div class="gallerymock"><div class="search">⌕ &nbsp; Search community vocabularies...</div><div class="tiles"><div><span>☀</span><b>Everyday Core</b><small>48 buttons · English</small></div><div><span>♫</span><b>Music &amp; Play</b><small>24 buttons · English</small></div><div><span>♥</span><b>Feelings</b><small>36 buttons · Bilingual</small></div></div></div>
			<div class="featurecopy"><p class="kicker">Made better together</p><h2>Don’t start from scratch.</h2><p>Browse boards shared by the community, keep a copy, and make it your own.</p><a class="textlink" href="/gallery">Visit the community gallery &nbsp;→</a></div>
		</article>
	</section>

	<section class="join" id="join">
		<div><h2>Welcome to <br> the commons.</h2><p>Join the people making communication more personal, collaborative, and accessible.</p></div>
		<div class="auth">
			{#if checking}<p>Loading…</p>{:else}
				<div class="tabs"><button class:active={mode === 'register'} onclick={() => mode = 'register'}>Create account</button><button class:active={mode === 'login'} onclick={() => mode = 'login'}>Sign in</button></div>
				<form onsubmit={submit}>
					{#if mode === 'register'}<label>Your name<input type="text" autocomplete="name" required bind:value={name} placeholder="Alex Morgan" /></label>{/if}
					<label>Email address<input type="email" autocomplete="email" required bind:value={email} placeholder="you@example.com" /></label>
					<label>Password<input type="password" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} required bind:value={password} placeholder="At least 8 characters" /></label>
					<button class="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create my free account'} <b>→</b></button>
					{#if message}<p class="ok">{message}</p>{/if}{#if error}<p class="err">{error}</p>{/if}
				</form>
			{/if}
		</div>
	</section>
	<footer class="sitefoot"><a class="brand" href="/"><VoiceCommonsBrand compact /></a><p>Free, open-source AAC for everyone.</p><div><a href="/gallery">Gallery</a><a href="#how">How it works</a></div></footer>
</main>

<style>
	:global(html){scroll-behavior:smooth}:global(body){margin:0;background:#fbfaf7}:global(*){box-sizing:border-box}
	main{--ink:#18312d;--green:#1d624f;--coral:#ef765d;--lime:#ddec77;color:var(--ink);background:#fbfaf7;font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow:hidden}
	nav,.hero,.features,.sitefoot{width:min(1180px,calc(100% - 48px));margin:auto}nav{height:86px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:3}
	.brand{display:flex;align-items:center;color:var(--ink);text-decoration:none}
	.navlinks{display:flex;align-items:center;gap:30px;font-size:14px;font-weight:700}.navlinks a,.sitefoot a{color:#4d615c;text-decoration:none}.navlinks button{border:1px solid #bac8c4;border-radius:99px;background:transparent;padding:10px 18px;color:var(--ink);font:inherit;cursor:pointer}
	.hero{min-height:640px;padding:55px 0 90px;display:grid;grid-template-columns:.9fr 1.1fr;gap:50px;align-items:center}.kicker{color:var(--green);font-size:12px;font-weight:850;letter-spacing:.14em;text-transform:uppercase}.copy>.kicker{display:flex;align-items:center;gap:9px}.copy>.kicker span{width:25px;height:2px;background:var(--coral)}
	h1,h2{margin:0;font-family:Georgia,serif;font-weight:500;letter-spacing:-.055em}h1{font-size:clamp(55px,6vw,82px);line-height:.98}em{color:var(--coral);font-weight:inherit}.lede{max-width:520px;margin:27px 0;color:#556a65;font-size:19px;line-height:1.65}.actions{display:flex;gap:12px}.actions button,.actions a{min-height:52px;padding:0 23px;display:flex;align-items:center;justify-content:center;border-radius:99px;font-size:15px;font-weight:750;text-decoration:none;cursor:pointer}.primary{border:0;background:var(--green);color:white;box-shadow:0 8px 20px #1d624f29}.actions a{border:1px solid #c9d3cf;background:white;color:var(--ink)}.copy>small{display:block;margin:14px 0 0 18px;color:#81908c}
	.scene{min-height:515px;position:relative;display:flex;align-items:center}.circle{position:absolute;width:510px;height:510px;border-radius:50%;background:#e8f0ad;right:-30px}.board{position:relative;width:570px;max-width:100%;padding:15px;border:1px solid #d9dfdc;border-radius:20px;background:white;box-shadow:0 28px 60px #204a3d25;transform:rotate(1.4deg)}.board>header{display:flex;align-items:center;justify-content:space-between;padding:3px 4px 13px;font-size:11px}.board>header b,.person{display:flex;align-items:center;gap:7px}.person i{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#f7cdbd;font-size:9px;font-style:normal}.message{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:7px 8px 7px 16px;border:1px solid #dbe1df;border-radius:10px;background:#f8faf9;font:18px Georgia}.message button{border:0;border-radius:8px;background:var(--green);color:white;padding:9px 13px;font-size:10px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:7px;border-radius:12px;background:#edf1ef}.word{aspect-ratio:1.25;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px 5px;border:1px solid #b7c1bd;border-radius:11px;box-shadow:0 2px 0 #a9b5b0}.word b{font-size:12px}.word span{font:26px Georgia}.bubble{position:absolute;right:-20px;bottom:13px;padding:15px 19px;border-radius:16px 16px 3px 16px;background:var(--coral);color:white;font:16px Georgia;box-shadow:0 10px 25px #a8483033;transform:rotate(-3deg)}.bubble span{color:#ffe38b}
	.manifesto{padding:90px 24px;background:var(--ink);color:white;text-align:center}.manifesto .kicker{color:var(--lime)}.manifesto h2{margin:13px 0 23px;font-size:clamp(40px,4.5vw,62px)}.manifesto>p:not(.kicker){max-width:730px;margin:auto;color:#c6d3d0;font-size:17px;line-height:1.7}.values{display:flex;justify-content:center;gap:35px;margin-top:37px;font-size:13px;font-weight:700}.values b{display:inline-grid;place-items:center;width:22px;height:22px;margin-right:7px;border-radius:50%;background:var(--lime);color:var(--ink)}
	.features{padding:100px 0;display:flex;flex-direction:column;gap:32px}.feature{min-height:465px;padding:60px;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;border-radius:30px}.mint{background:#e9f3ed}.peach{background:#f8e9df}.featurecopy h2{margin:10px 0 20px;font-size:clamp(38px,4vw,54px);line-height:1.04}.featurecopy>p:not(.kicker){color:#5b6c67;font-size:16px;line-height:1.65}.flow{display:flex;align-items:center;gap:9px;margin-top:28px;color:var(--coral);font-size:11px;font-weight:850}.flow span{padding:9px 11px;border-radius:99px;background:white;color:var(--ink);text-transform:uppercase}
	.approval,.gallerymock{padding:20px;border:1px solid #cedbd5;border-radius:18px;background:white;box-shadow:0 18px 45px #315e4d1a;transform:rotate(1deg)}.approval header,.approval header>div{display:flex;align-items:center;justify-content:space-between;gap:10px}.approval header i{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#f6d6c7;font-size:10px;font-style:normal;font-weight:800}.approval header p,.change p{display:flex;flex-direction:column;margin:0;font-size:12px}.approval header small{color:#899590;font-size:9px}.approval header>span{padding:6px 9px;border-radius:99px;background:#fff2cc;color:#77591c;font-size:8px;font-weight:800;text-transform:uppercase}.approval blockquote{margin:18px 0;padding:12px;border-radius:8px;background:#f5f7f6;color:#56645f;font:italic 13px Georgia}.change{display:flex;align-items:center;gap:15px;padding:12px 0;border-block:1px solid #edf0ef}.change>div{width:62px;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:space-around;border:1px solid #a7bcb3;border-radius:8px;background:#cce8d1;font-size:10px}.change>div span{font-size:20px}.change p small{color:var(--coral);font-size:8px;font-weight:900}.change p span{color:#899590;font-size:9px}.approval footer{display:flex;justify-content:end;gap:8px;padding-top:16px}.approval footer button{border:1px solid #cad3d0;border-radius:8px;background:white;padding:9px 12px;font-size:10px;font-weight:800}.approval footer button:last-child{border:0;background:var(--green);color:white}
	.peach{grid-template-columns:1.1fr .9fr}.gallerymock{transform:rotate(-1deg)}.search{padding:12px;border:1px solid #e1ded8;border-radius:9px;color:#999;font-size:11px}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px}.tiles>div{min-height:150px;padding:12px;display:flex;flex-direction:column;border:1px solid #e2dfd9;border-radius:11px}.tiles>div>span{flex:1;display:grid;place-items:center;margin-bottom:10px;border-radius:7px;background:#eef4d1;color:var(--green);font:34px Georgia}.tiles>div:nth-child(2)>span{background:#f6e4c0}.tiles>div:nth-child(3)>span{background:#f4d5db}.tiles b{font-size:10px}.tiles small{color:#999;font-size:7px}.textlink{display:inline-block;margin-top:10px;color:var(--green);font-size:14px;font-weight:800;text-decoration:none;border-bottom:1px solid #9cb7ae;padding-bottom:3px}
	.join{padding:100px max(24px,calc((100vw - 1080px)/2));display:grid;grid-template-columns:1fr 420px;gap:100px;align-items:center;background:#dfed83}.join h2{margin:10px 0 20px;font-size:clamp(42px,5vw,67px);line-height:1}.join h2 em{color:var(--green)}.join>div>p:last-child{max-width:500px;color:#526343;font-size:17px;line-height:1.6}.auth{min-height:390px;padding:22px;border-radius:20px;background:white;box-shadow:0 18px 50px #5365202e}.tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:4px;border-radius:10px;background:#eff2ee}.tabs button{border:0;border-radius:7px;padding:10px;background:transparent;color:#687570;font-size:12px;font-weight:800}.tabs button.active{background:white;color:var(--ink);box-shadow:0 2px 5px #243e3520}.auth form{display:flex;flex-direction:column;gap:13px;margin-top:18px}.auth label{display:flex;flex-direction:column;gap:6px;color:#52615d;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.auth input{border:1px solid #d4dcd8;border-radius:9px;padding:12px 13px;outline:none;font-size:13px}.auth input:focus{border-color:var(--green);box-shadow:0 0 0 3px #1d624f18}.submit{display:flex;justify-content:center;gap:20px;border:0;border-radius:9px;padding:13px;background:var(--green);color:white;font-size:12px;font-weight:800}.ok,.err{margin:0!important;padding:9px;border-radius:7px;background:#eaf4ed!important;color:#285b48!important;font-size:11px!important}.err{background:#fff0ed!important;color:#9b3c2d!important}
	.sitefoot{min-height:110px;display:flex;align-items:center;justify-content:space-between}.sitefoot .brand{font-size:17px}.sitefoot p,.sitefoot a{font-size:12px}.sitefoot div{display:flex;gap:24px}
	@media(max-width:900px){.hero{grid-template-columns:1fr}.copy{text-align:center}.copy>.kicker,.actions{justify-content:center}.lede{margin-inline:auto}.scene{min-height:470px}.feature{grid-template-columns:1fr;padding:45px}.peach .gallerymock{order:2}.join{grid-template-columns:1fr;gap:45px}.auth{max-width:500px}}
	@media(max-width:620px){nav{width:calc(100% - 32px);height:72px}.navlinks>a{display:none}.hero{width:calc(100% - 32px);padding:35px 0 65px}.hero h1{font-size:50px}.lede{font-size:16px}.actions{flex-direction:column}.scene{min-height:370px}.board{padding:9px}.word{padding:4px 2px}.word b{font-size:9px}.word span{font-size:19px}.bubble{right:-5px}.features{width:calc(100% - 24px);padding:55px 0}.feature{padding:28px 20px;border-radius:22px}.flow{flex-wrap:wrap}.tiles>div{min-height:120px;padding:7px}.join{padding:65px 20px}.sitefoot{padding:30px 0;flex-direction:column;justify-content:center}}
</style>
