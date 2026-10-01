// Widgets of Part IV (Chapters 14–18) written for the Forces-as-fields chapters. Numerics: src/lib/sims/part4.

/** Chapter 14: quanta of one mode: number states and coherent states of the field: `::quanta-ladder{n="14.2"}`. */
export { default as QuantaLadder } from '$lib/sims/part4/QuantaLadder.svelte';
/** Chapter 16: the angular distributions of e⁺e⁻ → μ⁺μ⁻ and Bhabha scattering, split by channel: `::angular-shapes{n="16.1"}`. */
export { default as AngularShapes } from '$lib/sims/part4/AngularShapes.svelte';
/** Chapter 16 flagship: a virtual e⁺e⁻ collider (σ, angles, A_FB, the R ratio): `::ee-collider{n="16.2"}`. */
export { default as EeCollider } from '$lib/sims/part4/EeCollider.svelte';
/** Chapters 16 and 18: the running couplings from hep/sm: `::running-couplings{which="alpha"|"alphas"|"both"}`. */
export { default as RunningCouplings } from '$lib/sims/part4/RunningCouplings.svelte';
/** Chapter 17: U(1), SU(2) and SU(3) as matrix groups, generators, commutators: `::gauge-groups{n="17.2"}`. */
export { default as GaugeGroups } from '$lib/sims/part4/GaugeGroups.svelte';
/** Chapter 18: simulated e⁺e⁻ → qq̄ events clustered with anti-kT; two- and three-jet events: `::shower-jets{n="18.2"}`. */
export { default as ShowerJets } from '$lib/sims/part4/ShowerJets.svelte';
/** Chapter 18 (under the hood): the Sudakov veto algorithm trial by trial: `::sudakov-veto{n="18.4"}`. */
export { default as SudakovVeto } from '$lib/sims/part4/SudakovVeto.svelte';
