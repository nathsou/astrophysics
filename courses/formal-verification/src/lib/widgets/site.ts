// Course-wide widgets used in chapters.

/** A live Vouch editor with its verdicts: `:::workbench{title="…"}` with a ```vouch block inside. */
export { default as Workbench } from '$lib/components/verify/Playground.svelte';
/** A read-only, highlighted Vouch snippet with an optional verdict (see `VouchSnippet`). */
export { default as TraceTable } from '$lib/components/verify/TraceView.svelte';
/** The state-space explorer: `:::state-space{title="…"}` with a ```vouch system inside. */
export { default as StateSpace } from '$lib/components/explore/StateSpace.svelte';
/** Be the scheduler: `:::interleavings{title="…"}` with a ```vouch system of processes inside. */
export { default as Interleavings } from '$lib/components/explore/Interleavings.svelte';
/** The trace lab: `::trace-lab{props='["req","grant"]' formulas='["…"]'}`. */
export { default as TraceLab } from '$lib/components/ltl/TraceLab.svelte';
/** Liveness with and without fairness: `:::liveness{title="…"}` with a ```vouch system inside. */
export { default as Liveness } from '$lib/components/ltl/LivenessLab.svelte';
/** A message sequence chart with an adversary: `:::msc{lanes='[…]' …}` with a ```vouch system inside. */
export { default as Msc } from '$lib/components/explore/Msc.svelte';
/** The encoding lab: `:::encoding-lab{title="…"}` with a ```vouch problem inside. */
export { default as EncodingLab } from '$lib/components/sat/EncodingLab.svelte';
/** The instance visualiser: `:::world-lab{title="…" maxScope=5}` with a ```vouch world inside. */
export { default as WorldLab } from '$lib/components/relational/WorldLab.svelte';
/** The unrolling view (bounded model checking): `:::bmc-lab{title="…" maxK=12 race=true}` with a ```vouch system inside. */
export { default as BmcLab } from '$lib/components/bmc/BmcLab.svelte';
/** Symbolic reachability with BDDs: `:::reach-lab{title="…" race=true}` with a ```vouch system inside. */
export { default as ReachLab } from '$lib/components/bdd/ReachLab.svelte';
/** The peephole court (chapter 14): `::peephole-court{rewrite="x * 2 => x << 1" docket='[…]'}`. */
export { default as PeepholeCourt } from '$lib/components/rewrite/PeepholeCourt.svelte';
/** The path tree explorer (chapter 15): `:::path-tree{fn="…"}` with a ```vouch block inside. */
export { default as PathTree } from '$lib/components/symex/PathTree.svelte';
