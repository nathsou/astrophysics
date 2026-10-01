// Widgets of Part III, "The zoo" (Chapters 9–13). Used in Markdown as ::kebab-name{…}. Logic lives in src/lib/sims/part3/ and src/lib/hep/{conservation,su3}.

/** Chapter 9: Dirac's two energy branches and pair creation: `::dirac-levels{n="9.1"}`. */
export { default as DiracLevels } from '$lib/sims/part3/DiracLevels.svelte';
/** Chapter 9: production thresholds for pair production and p p → p p p p̄: `::threshold-figure{n="9.4"}`. */
export { default as ThresholdFigure } from '$lib/sims/part3/ThresholdFigure.svelte';
/** Chapter 9: a toy PET scanner and its reconstruction: `::pet-scanner{n="9.5" seed=7}`. */
export { default as PetScanner } from '$lib/sims/part3/PetScanner.svelte';
/** Chapter 10 flagship: a toy air shower, with and without time dilation for the muons: `::air-shower{n="10.2" seed=4}`. */
export { default as AirShower } from '$lib/sims/part3/AirShower.svelte';
/** Chapter 10: survival probability of a muon against its energy: `::muon-survival{n="10.4"}`. */
export { default as MuonSurvival } from '$lib/sims/part3/MuonSurvival.svelte';
/** Chapter 10: the cos²θ law of the muon flux: `::zenith-flux{n="10.5"}`. */
export { default as ZenithFlux } from '$lib/sims/part3/ZenithFlux.svelte';
/** Chapter 11 flagship: type a reaction and see every law checked: `::reaction-judge{n="11.2" start="p -> e+ + gamma"}`. */
export { default as ReactionJudge } from '$lib/sims/part3/ReactionJudge.svelte';
/** Chapter 12: SU(3) weight diagrams from the highest weight: `::weight-diagram{n="12.1" p=1 q=1}`. */
export { default as WeightDiagram } from '$lib/sims/part3/WeightDiagram.svelte';
/** Chapter 12: the Δ resonance as a bump in π⁺p scattering (a model curve): `::delta-bump{n="12.2"}`. */
export { default as DeltaBump } from '$lib/sims/part3/DeltaBump.svelte';
/** Chapter 12 flagship: place the baryons, find the missing corner and predict its mass: `::eightfold-puzzle{n="12.3"}`. */
export { default as EightfoldPuzzle } from '$lib/sims/part3/EightfoldPuzzle.svelte';
/** Chapter 13: assemble colour-neutral hadrons from quarks: `::quark-builder{n="13.2"}`. */
export { default as QuarkBuilder } from '$lib/sims/part3/QuarkBuilder.svelte';
/** Chapter 13 flagship: the proton at increasing resolution, from the course's parton distributions: `::dis-proton{n="13.4"}`. */
export { default as DisProton } from '$lib/sims/part3/DisProton.svelte';
/** Chapter 13: Bjorken scaling in the course's parton distributions: `::scaling-plot{n="13.5"}`. */
export { default as ScalingPlot } from '$lib/sims/part3/ScalingPlot.svelte';
