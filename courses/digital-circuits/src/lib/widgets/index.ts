// Widgets shared across chapters (chapter-specific ones live in content/chapters/<ch>/widgets/).

/** A live circuit: `::circuit{src="<chapter>/circuits/<name>.json" title="…" mode="logic" speed=1 current=true traces="A,B,Y"}`. */
export { default as Circuit } from '$lib/bench/CircuitWidget.svelte';
