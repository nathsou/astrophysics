// Widgets of Part VII (Chapters 26 to 30): the Higgs boson. Used in Markdown as ::kebab-name{…}.

/** The Higgs potential along the radial direction, with the mass, cubic and quartic terms and (Chapter 30) a κ_λ slider: `::potential-slice{n="26.3" caption="…"}`. */
export { default as PotentialSlice } from '$lib/sims/part7/PotentialSlice.svelte';

/** Chapter 27: rate = σL for a ladder of processes against the 40 MHz, 100 kHz and 1 kHz marks: `::rate-ladder{n="27.1" caption="…"}`. */
export { default as RateLadder } from '$lib/sims/part7/RateLadder.svelte';
/** Chapter 27: the 4 µs Level-1 pipeline and its stages: `::l1-pipeline{n="27.2" caption="…"}`. */
export { default as L1Pipeline } from '$lib/sims/part7/L1Pipeline.svelte';
/** Chapter 27: real dimuon data with cuts on the two muons' pT, showing the trigger thresholds and the hump: `::dimuon-thresholds{n="27.3" caption="…"}`. */
export { default as DimuonThresholds } from '$lib/sims/part7/DimuonThresholds.svelte';

/** Chapter 28: CLs upper limits for a counting experiment, with CLs+b alone and the expected limit bands: `::limit-explorer{n="28.6" caption="…"}`. */
export { default as LimitExplorer } from '$lib/sims/part7/LimitExplorer.svelte';
