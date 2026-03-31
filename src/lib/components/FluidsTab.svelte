<script lang="ts">
	import { Droplets, Info } from 'lucide-svelte';
	import fluidsData from '$lib/data/fluids.json';

	// Inputs
	let weightStr = $state('');
	let ageValueStr = $state('');
	let ageUnit = $state('days'); // 'days', 'months', 'years'

	// Modifiers
	let selectedIncreases: string[] = $state([]);
	let selectedDecreases: string[] = $state([]);

	// Derived states
	let weight = $derived(parseFloat(weightStr) || 0);
	let ageValue = $derived(parseFloat(ageValueStr) || 0);

	// Helpers
	const ageInDays = $derived(
		ageUnit === 'days' ? ageValue : ageUnit === 'months' ? ageValue * 30 : ageValue * 365
	);
	const ageInMonths = $derived(
		ageUnit === 'months' ? ageValue : ageUnit === 'days' ? ageValue / 30 : ageValue * 12
	);

	function calculateBaseVolume() {
		if (weight <= 0 || ageValue <= 0) return null;

		let mlPerKg = 0;
        const maxNeonatalMonths = fluidsData.neonatal_daily_requirements[fluidsData.neonatal_daily_requirements.length - 1].max_months || 9;

		if (ageInDays <= maxNeonatalMonths * 30) {
			// Find neonatal or infant requirement
			const req = fluidsData.neonatal_daily_requirements.find(r => {
				if (r.max_months !== undefined) {
					return ageInDays >= r.min_days && ageInMonths <= r.max_months;
				} else {
					return ageInDays >= r.min_days && ageInDays <= r.max_days!;
				}
			});
			if (req) mlPerKg = req.ml_kg_day;
		} else {
			// Find pediatric bracket
			const bracket = fluidsData.pediatric_brackets.find(b =>
				ageInMonths >= b.min_months && ageInMonths <= b.max_months
			);
			if (bracket) {
				mlPerKg = (bracket.ml_kg_day_min + bracket.ml_kg_day_max) / 2;
			} else {
				mlPerKg = 50;
			}
		}

		if (mlPerKg === 0) return null;
		return mlPerKg * weight;
	}

	let baseVolume = $derived(calculateBaseVolume());

	let finalVolume = $derived.by(() => {
		if (!baseVolume) return null;

		let volume = baseVolume;

		if (selectedIncreases.length > 0) {
			const multiplier = 1 + (0.2 * selectedIncreases.length);
			volume = volume * multiplier;
		}

		if (selectedDecreases.length > 0) {
			const multiplier = 1 - (0.2 * selectedDecreases.length);
			volume = volume * multiplier;
		}

		if (volume > 2400) {
			return 2400;
		}

		return Math.round(volume);
	});

	let suggestedFluid = $derived.by(() => {
		if (weight <= 0 || ageValue <= 0) return null;

		if (ageInDays <= 1) {
			return weight > 1 ? fluidsData.fluid_types[0] : fluidsData.fluid_types[1];
		} else if (ageInMonths <= 24) {
			return weight > 1 ? fluidsData.fluid_types[2] : fluidsData.fluid_types[3];
		} else if (ageInMonths > 24 && ageInMonths <= 60) {
			return fluidsData.fluid_types[4];
		} else if (ageInMonths > 60 && ageInMonths <= 132) {
			return fluidsData.fluid_types[5];
		} else {
			return fluidsData.fluid_types[6];
		}
	});

	function toggleIncrease(condition: string) {
		if (selectedIncreases.includes(condition)) {
			selectedIncreases = selectedIncreases.filter(c => c !== condition);
		} else {
			selectedIncreases = [...selectedIncreases, condition];
		}
	}

	function toggleDecrease(condition: string) {
		if (selectedDecreases.includes(condition)) {
			selectedDecreases = selectedDecreases.filter(c => c !== condition);
		} else {
			selectedDecreases = [...selectedDecreases, condition];
		}
	}
</script>

<header class="bg-sky-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-center gap-2">
    <Droplets class="w-6 h-6" />
    <h1 class="text-xl font-bold">QuickRx Fluids</h1>
</header>

<main class="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

    <section class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 class="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Patient Parameters</h2>
        <div class="space-y-4">
            <div>
                <label for="fluid-weight" class="block text-sm font-semibold text-slate-700 mb-1">Weight (kg)</label>
                <input
                    id="fluid-weight"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.1"
                    bind:value={weightStr}
                    class="w-full h-12 px-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                    placeholder="e.g. 12.5"
                />
            </div>
            <div>
                <label for="fluid-age" class="block text-sm font-semibold text-slate-700 mb-1">Age</label>
                <div class="flex gap-2">
                    <input
                        id="fluid-age"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        bind:value={ageValueStr}
                        class="w-full h-12 px-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                        placeholder="e.g. 3"
                    />
                    <select
                        bind:value={ageUnit}
                        class="h-12 px-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                    >
                        <option value="days">Days</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                    </select>
                </div>
            </div>
        </div>
    </section>

    <section class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 class="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Clinical Conditions</h2>

        <div class="space-y-4">
            <div>
                <h3 class="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1">
                    <Droplets class="w-3 h-3" /> Increases Volume (+20%)
                </h3>
                <div class="grid grid-cols-2 gap-2">
                    {#each fluidsData.adjustments.increase_20_percent as condition}
                        <button
                            class="flex items-center p-2 border rounded-lg text-left text-sm transition-colors {selectedIncreases.includes(condition) ? 'bg-sky-50 border-sky-500 text-sky-800 font-medium' : 'bg-white border-slate-200 text-slate-600'}"
                            onclick={() => toggleIncrease(condition)}
                        >
                            <div class="w-4 h-4 rounded-sm border flex items-center justify-center mr-2 flex-shrink-0 {selectedIncreases.includes(condition) ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300'}">
                                {#if selectedIncreases.includes(condition)}
                                    <svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                {/if}
                            </div>
                            <span class="leading-tight">{condition}</span>
                        </button>
                    {/each}
                </div>
            </div>

            <div class="pt-2 border-t border-slate-100">
                <h3 class="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                    <Info class="w-3 h-3" /> Decreases Volume (-20%)
                </h3>
                <div class="grid grid-cols-2 gap-2">
                    {#each fluidsData.adjustments.decrease_20_percent as condition}
                        <button
                            class="flex items-start p-2 border rounded-lg text-left text-sm transition-colors {selectedDecreases.includes(condition) ? 'bg-amber-50 border-amber-500 text-amber-800 font-medium' : 'bg-white border-slate-200 text-slate-600'}"
                            onclick={() => toggleDecrease(condition)}
                        >
                            <div class="w-4 h-4 rounded-sm border flex items-center justify-center mr-2 mt-0.5 flex-shrink-0 {selectedDecreases.includes(condition) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}">
                                {#if selectedDecreases.includes(condition)}
                                    <svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                {/if}
                            </div>
                            <span class="leading-tight">{condition}</span>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    </section>

    <!-- Results Section -->
    <section class="bg-sky-50 p-5 rounded-xl border border-sky-200 shadow-inner text-center">
        <h2 class="text-sm font-bold text-sky-800 mb-1 uppercase tracking-wider">24-Hour Fluid Volume</h2>

        {#if finalVolume !== null}
            <div class="text-4xl font-bold text-sky-600 mb-1">
                {finalVolume} <span class="text-xl font-medium text-sky-700/80">ml/day</span>
            </div>

            {#if finalVolume === 2400}
                <div class="text-xs font-semibold text-amber-600 mt-1 bg-amber-100/50 inline-block px-2 py-1 rounded">
                    Max volume capped at 2400 ml/day
                </div>
            {:else if selectedIncreases.length > 0 || selectedDecreases.length > 0}
                <div class="text-xs text-sky-700 mt-1">
                    (Base: {Math.round(baseVolume!)} ml modified by conditions)
                </div>
            {/if}

            {#if suggestedFluid}
                <div class="mt-4 pt-4 border-t border-sky-200/50">
                    <h3 class="text-xs font-bold text-sky-800 mb-2 uppercase tracking-wider">Suggested Fluid Type</h3>
                    <div class="bg-white rounded-lg p-3 border border-sky-100 text-left">
                        <div class="font-bold text-slate-800 text-lg">{suggestedFluid.fluid}</div>
                        <div class="text-sm text-slate-600 mt-1">{suggestedFluid.content}</div>
                    </div>
                </div>
            {/if}
        {:else}
            <div class="py-4 text-sky-700/70 italic text-sm">
                Enter patient weight and age above to calculate fluids
            </div>
        {/if}
    </section>
</main>
