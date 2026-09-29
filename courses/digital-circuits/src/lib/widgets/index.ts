// Widgets shared across chapters (chapter-specific ones live in content/chapters/<ch>/widgets/).

/** A live circuit: `::circuit{src="<chapter>/circuits/<name>.json" title="…" mode="logic" speed=1 current=true traces="A,B,Y"}`. */
export { default as Circuit } from '$lib/bench/CircuitWidget.svelte';

/** A DCL design to edit, simulate, test and look inside: `::dcl-playground{src="designs/counter.dcl" top="Counter"}`. */
export { default as DclPlayground } from './dcl/DclPlayground.svelte';
/** The inference viewer: edit DCL and watch the netlist it becomes: `::dcl-inference{src="designs/counter.dcl"}`. */
export { default as DclInference } from './dcl/DclInference.svelte';

// ── Device Studio (src/lib/studio) ────────────────────────────────────────────────────────────

/** A compact Device Studio: `::device-studio{device="gal22v10" example="traffic-light" views="source,chip,logic"}` (devices: prom, pla, gal22v10, cpld32). */
export { default as DeviceStudio } from '../studio/widgets/DeviceStudio.svelte';
/** Blow the fuses of a small PROM to program a 7-segment decoder: `::prom-fuses{example="seven-segment"}`. */
export { default as PromFuses } from '../studio/widgets/PromFuses.svelte';
/** Program a PLA by hand, crossing by crossing, against a goal truth table: `::pla-planes{example="full-adder"}`. */
export { default as PlaPlanes } from '../studio/widgets/PlaPlanes.svelte';
/** The JTAG TAP controller: drive it by hand, or watch a programming run: `::jtag-tap{}`. */
export { default as JtagTap } from '../studio/widgets/JtagTap.svelte';
