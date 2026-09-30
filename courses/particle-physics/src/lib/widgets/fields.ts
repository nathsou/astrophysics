// Widgets of the "fields" area (Chapters 14, 17, 18 and 26). Numerics: src/lib/hep/fields.

/** Chapter 14 flagship: a chain (or sheet) of coupled oscillators as a scalar field: `::field-lattice{n="14.1" caption="…"}`. */
export { default as FieldLattice } from '$lib/sims/fields/FieldLattice.svelte';
/** Chapter 14: virtual-particle exchange, the Yukawa potential, range and Yukawa's 1935 inversion: `::propagator{n="14.3"}`. */
export { default as Propagator } from '$lib/sims/fields/Propagator.svelte';
/** Chapter 17 flagship: global and local phase symmetry on a grid of arrows, the link field and the plaquette: `::phase-dial{n="17.1"}`. */
export { default as PhaseDial } from '$lib/sims/fields/PhaseDial.svelte';
/** Chapter 17 (optional): 2D U(1) lattice gauge theory by Monte Carlo, exact plaquette and Wilson loops; WebGPU optional: `::lattice-gauge{n="17.3"}`. */
export { default as LatticeGauge } from '$lib/sims/fields/LatticeGauge.svelte';
/** Chapter 18 flagship: string breaking and hadronisation, a cartoon with exact energy accounting: `::string-breaking{n="18.1"}`. */
export { default as StringBreaking } from '$lib/sims/fields/StringBreaking.svelte';
/** Chapter 26 flagship: the Mexican-hat potential with a rolling ball, Higgs and Goldstone modes: `::mexican-hat{n="26.1"}`. */
export { default as MexicanHat } from '$lib/sims/fields/MexicanHat.svelte';
/** Chapter 26: all Standard Model masses on a log axis with the Yukawa coupling scale: `::mass-spectrum{n="26.3"}`. */
export { default as MassSpectrum } from '$lib/sims/fields/MassSpectrum.svelte';
