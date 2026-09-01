<script lang="ts">
	// The row that says who built this, carried by every page a visitor can
	// reach without an account. Its colours are neutral enough to sit on both
	// the landing page's paper and the slate the rest of the site uses.
</script>

<footer class="sitefooter">
	<a class="builtby" href="https://edtechathon.com" target="_blank" rel="noopener noreferrer">
		<img src="/edtechathon/logo.svg" alt="" width="24" height="24" />
		Built by the EdTech-a-thon
	</a>
	<a href="/about">about</a>
	<a href="/privacy">privacy</a>
</footer>

<style>
	.sitefooter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 1rem;
		width: 100%;
		max-width: 48rem;
		margin-inline: auto;
		padding: 1rem 1rem 1.5rem;
		text-align: center;
	}

	.sitefooter a {
		color: #64748b;
		font-size: 0.875rem;
		text-decoration: none;
	}

	.sitefooter a:hover {
		color: #1d4ed8;
	}

	.builtby {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.builtby img {
		height: 1.5rem;
		width: 1.5rem;
	}
</style>
