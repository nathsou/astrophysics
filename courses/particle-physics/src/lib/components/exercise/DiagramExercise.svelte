<!--
  The diagram exercise: draw the Feynman diagrams of a process. The same engine as the Chapter 15 sketchpad checks the reader's
  diagrams against every enumerated tree diagram of the process; the exercise is passed when the reader has found all of them
  (`answer: all`, the default) or the requested number (`answer: 2`).

  ```diagram
  id: qed/ee-mumugamma
  title: Radiation in e⁺e⁻ → μ⁺μ⁻γ
  prompt: Draw every tree diagram of …
  process: e+ e- > mu+ mu- gamma
  answer: all
  config: { forces: [qed] }
  ```
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import SketchpadCore from '$lib/feynman/SketchpadCore.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { tryParseProcess, type EnumerateOptions, type Force } from '$lib/hep/diagrams';
  import type { ExerciseBase } from './types';

  type DiagramSpec = ExerciseBase & {
    /** The process in text form, e.g. "e+ e- > mu+ mu-". */
    process?: string;
    /** `all` (default) or the number of different diagrams to find. */
    answer?: 'all' | number | string;
    /** Interactions of the answer key and other enumeration options. */
    config?: { forces?: Force[] | string; ckm?: 'auto' | 'diagonal' | 'full'; minYukawaMass?: number; maxOrder?: EnumerateOptions['maxOrder'] };
    forces?: Force[] | string;
  };
  let { spec }: { spec: ExerciseBase & Record<string, unknown> } = $props();
  const s = $derived(spec as DiagramSpec);

  const parsed = $derived(tryParseProcess(s.process ?? ''));
  const options = $derived.by((): EnumerateOptions => {
    const c = s.config ?? {};
    const f = c.forces ?? s.forces;
    const forces = typeof f === 'string' ? (f.split(/[,\s]+/).filter(Boolean) as Force[]) : f;
    return { ...(forces && forces.length ? { forces } : {}), ...(c.ckm ? { ckm: c.ckm } : {}), ...(c.minYukawaMass !== undefined ? { minYukawaMass: c.minYukawaMass } : {}), ...(c.maxOrder !== undefined ? { maxOrder: c.maxOrder } : {}) };
  });
  const target = $derived.by((): 'all' | number => {
    const a = s.answer;
    if (a === undefined || a === 'all') return 'all';
    const n = Number(a);
    return Number.isFinite(n) && n > 0 ? n : 'all';
  });
  let done = $state(false);
  let mounted = $state(false);
  onMount(() => {
    progress.load();
    mounted = true;
  });
  const solved = $derived(done || (mounted && progress.isSolved(spec.id)));
</script>

<ExerciseFrame id={spec.id} kind="Diagram" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={spec.solution}>
  {#if !parsed.ok}
    <p class="ui err" role="alert">This exercise has a process that cannot be read: {parsed.error}</p>
  {:else}
    <SketchpadCore
      process={parsed.process}
      {options}
      {target}
      storageId={spec.id}
      onsolved={() => {
        done = true;
        progress.markSolved(spec.id);
      }}
    />
    {#if solved}
      <p class="ui done" role="status">Solved. {#if spec.explain}<span>{@html spec.explain}</span>{/if}</p>
    {/if}
  {/if}
</ExerciseFrame>

<style>
  .err {
    color: var(--bad);
  }
  .done {
    margin: 0.7rem 0 0;
    padding: 0.5rem 0.8rem;
    border-left: 3px solid var(--ok);
    background: var(--ok-soft);
    color: var(--ok);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .done span {
    font-weight: 400;
    color: var(--ink);
  }
</style>
