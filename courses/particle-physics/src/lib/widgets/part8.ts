// Widgets of Part VIII (Chapters 31–33) and appendix D. Used in Markdown as ::kebab-name{…}.

/** The oscillation lab: three-flavour probabilities, vacuum and matter, experiment presets: `::oscillation-lab{n="31.1"}`. */
export { default as OscillationLab } from '$lib/sims/part8/OscillationLab.svelte';
/** The two-flavour formula in action, drawn through the hook `oscillations.probability`: `::two-flavour{n="31.2"}`. */
export { default as TwoFlavour } from '$lib/sims/part8/TwoFlavour.svelte';
/** Atmospheric muon neutrinos against the zenith angle (a toy of Super-Kamiokande's 1998 result): `::zenith-angle{n="31.3"}`. */
export { default as ZenithAngle } from '$lib/sims/part8/ZenithAngle.svelte';
/** Solar electron-neutrino survival against energy (adiabatic MSW, toy): `::solar-msw{n="31.4"}`. */
export { default as SolarMsw } from '$lib/sims/part8/SolarMsw.svelte';
/** The effective Majorana mass against the lightest mass for both orderings: `::mass-bands{n="31.5"}`. */
export { default as MassBands } from '$lib/sims/part8/MassBands.svelte';
/** The search sandbox: a hypothetical Z′ in the dimuon spectrum, with limits (simulated, toy): `::search-sandbox{n="32.1"}`. */
export { default as SearchSandbox } from '$lib/sims/part8/SearchSandbox.svelte';
/** Freeze-out of a thermal relic (toy): `::freeze-out{n="32.2"}`. */
export { default as FreezeOut } from '$lib/sims/part8/FreezeOut.svelte';
/** Published values of the muon g − 2 and their differences: `::g-minus-2{n="32.3"}`. */
export { default as GMinus2 } from '$lib/sims/part8/GMinus2.svelte';
/** Muography: muon counts through a pyramid with and without a hidden chamber (toy): `::muography{n="33.1"}`. */
export { default as Muography } from '$lib/sims/part8/Muography.svelte';
/** Proton depth–dose against photons, with a spread-out Bragg peak (toy): `::bragg-peak{n="33.2"}`. */
export { default as BraggPeak } from '$lib/sims/part8/BraggPeak.svelte';
/** PET in two dimensions: lines of response and back-projection (toy): `::pet-ring{n="33.3"}`. */
export { default as PetRing } from '$lib/sims/part8/PetRing.svelte';
/** Appendix D: every particle of hep/particles, filterable and sortable: `::particle-table{n="D.1"}`. */
export { default as ParticleTable } from '$lib/sims/part8/ParticleTable.svelte';
/** Appendix D: the twelve fermions and the bosons on one logarithmic mass axis: `::sm-chart{n="D.2"}`. */
export { default as SmChart } from '$lib/sims/part8/SmChart.svelte';
/** One-loop running of the three gauge couplings, with and without supersymmetry (toy): `::coupling-running{n="32.4"}`. */
export { default as CouplingRunning } from '$lib/sims/part8/CouplingRunning.svelte';
