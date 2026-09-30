// Widgets of the "display" area (the event display). Add exports here: export { default as Name } from "./path.svelte";

/** The event display (3D, transverse, longitudinal and η–φ views) for code: `<EventDisplay event={…} geometry={…} views={['3d','rphi']} />`. */
export { default as EventDisplay } from '$lib/display/EventDisplay.svelte';
/** A chapter figure with simulated events: `::event-display-widget{sample="zmumu" n="7.1" caption="…"}` (samples: zmumu, h4e, hgg, dijet, wenu, pileup, stress). */
export { default as EventDisplayWidget } from '$lib/display/EventDisplayWidget.svelte';
/** Truth and reconstruction side by side with linked selection: `::truth-reco-compare{sample="h4e" n="7.3"}`. */
export { default as TruthRecoCompare } from '$lib/display/TruthRecoCompare.svelte';
/** The key to particle colours and line styles: `::particle-legend{kinds="muon,electron,photon"}`. */
export { default as ParticleLegend } from '$lib/display/ParticleLegend.svelte';
/** Fire a single particle through the detector (Chapter 7): `::particle-gun-3d{n="7.2"}`. */
export { default as ParticleGun3D } from '$lib/display/ParticleGun3D.svelte';
