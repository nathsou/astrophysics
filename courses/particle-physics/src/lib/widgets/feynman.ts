// Widgets of the "feynman" area: Feynman diagrams, the gallery of all diagrams of a process, and the diagram sketchpad.

/** A diagram drawn from its text description: `::feynman{process="e+ e- > mu+ mu-" index=0 n="15.1" caption="…"}`. */
export { default as Feynman } from '$lib/feynman/Feynman.svelte';
/** The bare SVG diagram without a figure frame (used by other widgets and by exercises). */
export { default as FeynmanDiagram } from '$lib/feynman/FeynmanDiagram.svelte';
/** Every diagram of a process with its coupling order: `::diagram-gallery{process="e+ e- > e+ e-" forces="qed" n="15.3"}`. */
export { default as DiagramGallery } from '$lib/feynman/DiagramGallery.svelte';
/** The diagram sketchpad: draw a process and the vertex rules judge it: `::diagram-sketchpad{process="e+ e- > mu+ mu-" forces="qed,weak" n="15.2"}`. */
export { default as DiagramSketchpad } from '$lib/feynman/DiagramSketchpad.svelte';
