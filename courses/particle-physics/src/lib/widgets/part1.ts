// Widgets of Part I (Chapters 3 and 4): quantum essentials and scattering. Used in Markdown as ::kebab-name{…}.

/** The decay clock: N unstable particles, τ and Γ linked by one slider, optional Geiger clicks: `::decay-clock{n="3.1" preset="mu" count=300}`. */
export { default as DecayClock } from '$lib/sims/part1/DecayClock.svelte';
/** The Breit–Wigner line and the detector: theory, a toy particle gun, and real CMS dimuon data: `::breit-wigner-lab{n="3.2" particle="z" mode="theory"}`. */
export { default as BreitWignerLab } from '$lib/sims/part1/BreitWignerLab.svelte';
/** Rate = σ L and Poisson counting: `::rate-counts{n="3.4" process="z" lumi=1e34 seconds=1}`. */
export { default as RateCounts } from '$lib/sims/part1/RateCounts.svelte';
