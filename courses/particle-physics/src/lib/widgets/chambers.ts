// Widgets of the "chambers" area: cloud chamber, bubble chamber, scanning table.
/** A diffusion cloud chamber: `::cloud-chamber{n="5.1" caption="…" field=0 source="mixed"}`, or `preset="anderson"` for Anderson's photograph. */
export { default as CloudChamber } from '$lib/sims/chambers/CloudChamber.svelte';
/** A liquid-hydrogen bubble chamber with re-simulated events: `::bubble-chamber{n="12.4" preset="omega" caption="…"}` (presets: omega, v0, pair). */
export { default as BubbleChamber } from '$lib/sims/chambers/BubbleChamber.svelte';
/** The scanning table: ruler, three-point circle and angle tools on a simulated picture: `::scan-table{n="5.4" preset="cloud:alpha,mu-,e+" seed=3}`. */
export { default as ScanTable } from '$lib/sims/chambers/ScanTable.svelte';
