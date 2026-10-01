/**
 * The event display library (no Svelte components here; import those from `$lib/display/<Name>.svelte`, or use the widget
 * exports in `$lib/widgets/display.ts`).
 *
 *   geometry      DisplayGeometry, defaultGeometry, geometryFromDetectorConfig
 *   sampleEvents  sampleEvent(name, { seed }), sampleEvents(name, n, seed), gunEvent({ pdg, pt, eta, phi })
 *   scene         buildScene(event, geometry) → DisplayScene (objects, links, drawing primitives), highlightStates
 *   inspect       inspect(scene, id) → the inspector card's content
 *   helix, camera, pick, scenePick, colour, glData   the maths behind the views
 *
 * The particle colours and line styles live in `$lib/theme/particles`.
 */
export * from './geometry.ts';
export * from './helix.ts';
export * from './sampleEvents.ts';
export * from './scene.ts';
export * from './inspect.ts';
export * from './types.ts';
export { Camera, View2D, signedRho } from './camera.ts';
export { ScenePicker, type Projector, type PickFlags } from './scenePick.ts';
export { ptColour, ptFraction, ptGradientCss, PT_RAMP_LO, PT_RAMP_HI } from './colour.ts';
export type { ColourBy, RenderOptions } from './glData.ts';
