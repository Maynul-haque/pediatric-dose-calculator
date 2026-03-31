<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { loadInitialData } from '$lib/db';
	import { Pill, Droplets } from 'lucide-svelte';
	import { page } from '$app/stores';

	let { children } = $props();

	onMount(async () => {
		try {
			await loadInitialData();
		} catch (error) {
			console.error("Failed to load initial data", error);
		}
	});

	let activeTab = $derived($page.url.pathname === '/fluids' ? 'fluids' : 'drugs');
</script>

<div class="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50 relative pb-safe">
	{@render children()}

	<!-- Bottom Navigation Bar -->
	<nav class="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-200 flex justify-around items-center pb-safe-bottom z-50">
		<a
			href="/"
			class="flex-1 flex flex-col items-center justify-center py-3 {activeTab === 'drugs' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'} transition"
		>
			<Pill class="w-6 h-6 mb-1" />
			<span class="text-[10px] font-semibold uppercase tracking-wide">Drugs</span>
		</a>
		<a
			href="/fluids"
			class="flex-1 flex flex-col items-center justify-center py-3 {activeTab === 'fluids' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'} transition"
		>
			<Droplets class="w-6 h-6 mb-1" />
			<span class="text-[10px] font-semibold uppercase tracking-wide">Fluids</span>
		</a>
	</nav>
</div>
