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

/** Chapter 29: the diphoton analysis on simulated events (cut flow, mass histogram, Crystal Ball fit, local significance): `::higgs-hunt{n="29.3" caption="…"}`. */
export { default as HiggsHunt } from '$lib/sims/part7/HiggsHunt.svelte';
/** Chapter 29: the same four-lepton analysis on real CMS open data and on simulation, one button to swap: `::four-lepton-swap{n="29.4" caption="…"}`. */
export { default as FourLeptonSwap } from '$lib/sims/part7/FourLeptonSwap.svelte';

/** Chapter 30: the Standard Model's coupling-against-mass line with each particle's test status (the prediction; no measured value is drawn): `::coupling-line{n="30.1" caption="…"}`. */
export { default as CouplingLine } from '$lib/sims/part7/CouplingLine.svelte';
/** Chapter 30: Higgs branching fractions against mass from `hep/sm` higgsWidths, beside the particle table: `::higgs-branching{n="30.2" caption="…"}`. */
export { default as HiggsBranching } from '$lib/sims/part7/HiggsBranching.svelte';
/** Chapter 30: a one-loop toy of the running of λ and the stability of the vacuum, with the top-mass slider: `::vacuum-running{n="30.4" caption="…"}`. */
export { default as VacuumRunning } from '$lib/sims/part7/VacuumRunning.svelte';
