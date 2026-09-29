// Widgets shared across chapters (chapter-specific ones live in content/chapters/<ch>/widgets/).

/** A live circuit: `::circuit{src="<chapter>/circuits/<name>.json" title="…" mode="logic" speed=1 current=true traces="A,B,Y"}`. */
export { default as Circuit } from '$lib/bench/CircuitWidget.svelte';

/** A DCL design to edit, simulate, test and look inside: `::dcl-playground{src="designs/counter.dcl" top="Counter"}`. */
export { default as DclPlayground } from './dcl/DclPlayground.svelte';
/** The inference viewer: edit DCL and watch the netlist it becomes: `::dcl-inference{src="designs/counter.dcl"}`. */
export { default as DclInference } from './dcl/DclInference.svelte';
