// Widgets shared across chapters (chapter-specific ones live in content/chapters/<ch>/widgets/).
// Each export is used in Markdown as `::kebab-name{prop=…}` (see tools/markdown/compile.ts).


/** The dimuon map: real CMS muon pairs, mass computed by the reader's code if installed: `::dimuon-map{reveal="rho,phi" n="2.1"}`. */
export { default as DimuonMap } from './DimuonMap.svelte';

// Per-area widget files, one per agent or area, so that parallel work does not collide on this file.
export * from './display.ts';
export * from './feynman.ts';
export * from './chambers.ts';
export * from './fields.ts';
export * from './machine.ts';
export * from './sims.ts';
export * from './trigger.ts';
export * from './analysis.ts';
export * from './units.ts';
