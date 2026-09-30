// Widgets of the "analysis" area (Chapters 28 and 29): statistics of discovery and the selection. Used in Markdown as ::kebab-name{…}.

/** The bump hunter: inject a signal, scan for bumps, run signal-free pseudo-experiments, compare local and global p-values: `::bump-hunter{n="28.1" signal=0 seed=2 toys=2000}`. */
export { default as BumpHunter } from '$lib/sims/stats/BumpHunter.svelte';
/** The p-value of a Poisson counting experiment with the 3σ and 5σ thresholds: `::p-value{n="28.2" b=3.5 observed=9 uncertainty=0}`. */
export { default as PValue } from '$lib/sims/stats/PValue.svelte';
/** Interactive fit of a peak on a background, with the likelihood surface and pulls: `::fit-explorer{mode="diphoton" n="28.3"}` (mode: diphoton | fourlepton | generic). */
export { default as FitExplorer } from '$lib/sims/stats/FitExplorer.svelte';
/** The look-elsewhere effect: local against global significance, with an ILLUSTRATIVE 750 GeV-like scenario: `::look-elsewhere{n="28.4" windows=100 z=3}`. */
export { default as LookElsewhere } from '$lib/sims/stats/LookElsewhere.svelte';
/** A nuisance parameter widening the uncertainty, and the published LEP luminosity lesson (N_ν before and after): `::systematics{n="28.5"}`. */
export { default as Systematics } from '$lib/sims/stats/Systematics.svelte';
/** Toy signal and background in two variables with sliders for the cuts and a live expected significance: `::cut-optimiser{n="29.2"}`. */
export { default as CutOptimiser } from '$lib/sims/stats/CutOptimiser.svelte';
