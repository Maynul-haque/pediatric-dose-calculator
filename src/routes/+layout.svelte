<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { loadInitialData } from '$lib/db';

	let { children } = $props();

	onMount(async () => {
		try {
			await loadInitialData();
		} catch (error) {
			console.error("Failed to load initial data", error);
		}
	});
</script>

{@render children()}
