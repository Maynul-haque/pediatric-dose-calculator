<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import { Search, Calculator, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-svelte';
	import * as math from 'mathjs';

	let weightStr = $state('');
	let ageStr = $state('');
	let searchQuery = $state('');
	let drugs: any[] = $state([]);
	let filteredDrugs: any[] = $state([]);
	let expandedId: string | null = $state(null);

	// Severe warnings to check
	const SEVERE_WARNINGS = [
		'Not Recommended',
		'Contra indication',
		'Nephrotoxic',
		'Cardio-respiratory Distress',
		'Apnoea',
		'Bradicardia',
		'Cyanosis',
		'very slowly',
		'over 15min',
		'over 30 min'
	];

	function containsSevereWarning(text: string | null) {
		if (!text) return false;
		const lowerText = text.toLowerCase();
		return SEVERE_WARNINGS.some((warning) => lowerText.includes(warning.toLowerCase()));
	}

	function calculateDose(shortcut: string | null, weightStr: string) {
		if (!shortcut || !weightStr) return null;
		const weight = parseFloat(weightStr);
		if (isNaN(weight) || weight <= 0) return null;

		try {
			// Replace mathematical formatting, 'x' with '*', and allow lowercase 'wt'
			let formula = shortcut.toLowerCase().replace(/x/g, '*');

			// Replace variables
			let evaluated = math.evaluate(formula, { wt: weight });

			// Sometimes the shortcut includes the unit at the end like "(wt * 1) ml"
			// math.js might fail if there's raw text. Let's try to extract the math part.
			if (typeof evaluated === 'number') {
			   return Number(evaluated.toFixed(2));
			}

			// If it fails or returns something weird, try to just eval the part inside parentheses
			// if the string looks like "(wt * 1) ml"
			const match = formula.match(/\(([^)]+)\)/);
			if (match) {
				const innerFormula = match[1];
				evaluated = math.evaluate(innerFormula, { wt: weight });
				return Number(evaluated.toFixed(2));
			}

			// Try without text
			const cleanedFormula = formula.replace(/[a-z]+$/i, '').trim();
			evaluated = math.evaluate(cleanedFormula, { wt: weight });
			if (typeof evaluated === 'number') {
			   return Number(evaluated.toFixed(2));
			}

			return null;
		} catch (e) {
			console.error("Error evaluating formula:", shortcut, e);
			return null;
		}
	}

	onMount(async () => {
		// Fetch initial drugs from dexie
		drugs = await db.drugs.toArray();
		filteredDrugs = drugs;
	});

	$effect(() => {
		const query = searchQuery.toLowerCase().trim();
		if (!query) {
			filteredDrugs = drugs;
		} else {
			filteredDrugs = drugs.filter(
				(drug) =>
					drug.generic_name?.toLowerCase().includes(query) ||
					drug.brand_names?.some((bn: string) => bn.toLowerCase().includes(query))
			);
		}
	});

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<svelte:head>
	<title>QuickRx Pediatric Dose Calculator</title>
</svelte:head>

<div class="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50 relative pb-safe">
	<!-- Header -->
	<header class="bg-sky-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-center gap-2">
		<Calculator class="w-6 h-6" />
		<h1 class="text-xl font-bold">QuickRx</h1>
	</header>

	<!-- Input Section -->
	<section class="p-4 bg-white shadow-sm z-0">
		<div class="flex gap-4">
			<div class="flex-1">
				<label for="weight" class="block text-sm font-semibold text-slate-700 mb-1">Patient Weight (kg)</label>
				<input
					id="weight"
					type="number"
					inputmode="decimal"
					min="0"
					step="0.1"
					bind:value={weightStr}
					class="w-full h-12 px-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
					placeholder="e.g. 12.5"
				/>
			</div>
			<div class="flex-1">
				<label for="age" class="block text-sm font-semibold text-slate-700 mb-1">Patient Age</label>
				<input
					id="age"
					type="text"
					bind:value={ageStr}
					class="w-full h-12 px-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
					placeholder="e.g. 3y 2m"
				/>
			</div>
		</div>
	</section>

	<!-- Search Section -->
	<section class="p-4 bg-slate-50 sticky top-16 z-10 border-b border-slate-200 shadow-sm">
		<div class="relative">
			<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
				<Search class="h-5 w-5 text-slate-400" />
			</div>
			<input
				type="text"
				bind:value={searchQuery}
				class="block w-full h-12 pl-10 pr-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition shadow-sm"
				placeholder="Search by generic or brand name..."
			/>
		</div>
	</section>

	<!-- Results List -->
	<main class="flex-1 overflow-y-auto p-4 space-y-3 pb-8">
		{#if filteredDrugs.length === 0}
			<div class="text-center text-slate-500 py-8">
				No drugs found matching "{searchQuery}"
			</div>
		{/if}

		{#each filteredDrugs as drug (drug.id)}
			<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 {expandedId === drug.id ? 'ring-2 ring-sky-500/50' : ''}">
				<!-- Card Header (Tappable) -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="p-4 flex items-center justify-between cursor-pointer select-none active:bg-slate-50"
					onclick={() => toggleExpand(drug.id)}
				>
					<div>
						<h2 class="text-lg font-bold text-slate-800">{drug.generic_name}</h2>
						{#if drug.brand_names?.length > 0}
							<p class="text-sm text-slate-500 mt-0.5 truncate">{drug.brand_names.join(', ')}</p>
						{/if}
					</div>
					<button class="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
						{#if expandedId === drug.id}
							<ChevronUp class="w-6 h-6" />
						{:else}
							<ChevronDown class="w-6 h-6" />
						{/if}
					</button>
				</div>

				<!-- Expanded Content -->
				{#if expandedId === drug.id}
					<div class="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-4">

						<!-- Calculation Result Highlight -->
						<div class="bg-sky-50 rounded-lg p-4 border border-sky-100 shadow-inner mt-2">
							<div class="text-sm font-semibold text-sky-800 mb-1">Calculated Dose</div>
							{#if weightStr && !isNaN(parseFloat(weightStr))}
								{#if drug.calculation_shortcut}
									{@const dose = calculateDose(drug.calculation_shortcut, weightStr)}
									{#if dose !== null}
										<div class="text-2xl font-bold text-sky-600 break-words flex items-baseline gap-2">
											{dose}
											<span class="text-sm font-medium text-sky-700/80">({drug.calculation_shortcut})</span>
										</div>
									{:else}
										<div class="text-slate-600 text-sm italic">Formula too complex to parse safely. See instructions below.</div>
									{/if}
								{:else}
									<div class="text-slate-600 text-sm italic">No auto-calculation shortcut available for this drug. See instructions below.</div>
								{/if}
							{:else}
								<div class="text-slate-500 text-sm italic">Enter patient weight above to calculate dose</div>
							{/if}
						</div>

						<!-- Clinical Details -->
						<div class="grid grid-cols-2 gap-3 mt-4 text-sm">
							<div>
								<span class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dose Guideline</span>
								<span class="font-medium text-slate-800">{drug.dose_guideline || 'N/A'}</span>
							</div>
							<div>
								<span class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Frequency</span>
								<span class="font-medium text-slate-800">{drug.frequency || 'N/A'}</span>
							</div>
							{#if drug.formulations?.length > 0}
								<div class="col-span-2">
									<span class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Formulations</span>
									<div class="flex flex-wrap gap-1.5 mt-1">
										{#each drug.formulations as form}
											<span class="inline-block px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-xs">{form}</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>

						<!-- Special Instructions & Warnings -->
						{#if drug.special_instructions}
							<div class="mt-4 pt-4 border-t border-slate-200">
								<span class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Instructions & Notes</span>

								{#if containsSevereWarning(drug.special_instructions)}
									<div class="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 mb-2">
										<AlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
										<p class="text-sm font-medium leading-relaxed">{drug.special_instructions}</p>
									</div>
								{:else}
									<p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{drug.special_instructions}</p>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</main>
</div>
