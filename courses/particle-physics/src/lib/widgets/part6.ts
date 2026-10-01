// Widgets of Part VI, the weak force (Chapters 22 to 25). Used in Markdown as ::kebab-name{…}.

/** Chapter 22 flagship: Wu's experiment and its mirror image: `::mirror{n="22.1" caption="…"}`. */
export { default as Mirror } from '$lib/sims/part6/Mirror.svelte';
/** Chapter 22: the continuous beta spectrum from phase space, with the two-body line for comparison: `::beta-spectrum{n="22.2"}`. */
export { default as BetaSpectrum } from '$lib/sims/part6/BetaSpectrum.svelte';
/** Chapter 22: helicity suppression of π → eν, the rate against the lepton mass: `::helicity-suppression{n="22.3"}`. */
export { default as HelicitySuppression } from '$lib/sims/part6/HelicitySuppression.svelte';
/** Chapters 22 and 24: the conservation ledger with parity (stage 22) and CP (stage 24) struck through: `::ledger-strike{stage="22"}`. */
export { default as LedgerStrike } from '$lib/sims/part6/LedgerStrike.svelte';
/** Chapter 23: sin²θ_W, the tree-level W and Z masses and the neutral-current ratios: `::weak-mixing{n="23.1"}`. */
export { default as WeakMixing } from '$lib/sims/part6/WeakMixing.svelte';
/** Chapter 23 flagship: fit the simulated, LEP-like Z lineshape with 2, 3 and 4 neutrino species: `::counting-neutrinos{n="23.2"}`. */
export { default as CountingNeutrinos } from '$lib/sims/part6/CountingNeutrinos.svelte';
/** Chapter 23: W → ℓν at the SppS and the LHC, the Jacobian edge and the transverse mass (uses the reader's missingPt and transverseMass): `::w-transverse{n="23.3"}`. */
export { default as WTransverse } from '$lib/sims/part6/WTransverse.svelte';
/** Chapter 23: a toy of stochastic cooling, sample size and gain: `::stochastic-cooling{n="23.4"}`. */
export { default as StochasticCooling } from '$lib/sims/part6/StochasticCooling.svelte';
