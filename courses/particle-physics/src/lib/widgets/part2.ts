// Widgets of Part II (Seeing particles): chapters 5 to 8. Shared figures live in src/lib/sims/part2/.

/** Momentum resolution of a tracker: the bend against the error, and Gluckstern's two terms with a Monte Carlo: `::pt-resolution{n="5.5" caption="…"}`. */
export { default as PtResolution } from '$lib/sims/part2/PtResolution.svelte';

/** Fire an electron, photon, pion or muon into lead, iron, copper or water: `::shower-lab{n="6.3" caption="…"}` (props: particle, material, energy, seed). */
export { default as ShowerLab } from '$lib/sims/part2/ShowerLab.svelte';

/** Design a detector within a budget and see what it measures: `::detector-designer{n="7.5" caption="…"}`. */
export { default as DetectorDesigner } from '$lib/sims/part2/DetectorDesigner.svelte';

/** The reader's tracker against the reference under growing pile-up: `::pileup-tracking{n="8.6" caption="…"}`. */
export { default as PileupTracking } from '$lib/sims/part2/PileupTracking.svelte';
