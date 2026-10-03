// Course-wide widgets used in chapters.

/** A live Vouch editor with its verdicts: `:::workbench{title="…"}` with a ```vouch block inside. */
export { default as Workbench } from '$lib/components/verify/Playground.svelte';
/** A read-only, highlighted Vouch snippet with an optional verdict (see `VouchSnippet`). */
export { default as TraceTable } from '$lib/components/verify/TraceView.svelte';
