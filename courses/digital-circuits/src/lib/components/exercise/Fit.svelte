<!--
  A ```fit block: program a device (a PLA, a GAL22V10 or a vCPLD-32) to a specification, within its resources.
  The reader works in the Device Studio's own panes (source, chip, report), and Check runs the *configured device*
  (the fuses or bits, not the text) against the spec and counts its product terms, macrocells and registers against
  the budget. A PLA can also be programmed by hand: click the crossings.

    id: ch25/excess-3
    device: pla
    blank: true
    spec:
      truthTable: { inputs: [D, C, B, A], outputs: [E3, E2, E1, E0], rows: ["0000 0011", …] }
    budget: { terms: 7 }
    start: |
      …
    solution: |
      …

  See fit/check.ts for the fields and the checker.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Icon from '../ui/Icon.svelte';
  import Mismatch from './parts/Mismatch.svelte';
  import Verdict from './parts/Verdict.svelte';
  import './parts/exercise.css';
  import { Studio } from '$lib/studio/studio.svelte';
  import StudioApp from '$lib/studio/StudioApp.svelte';
  import { blankPla } from '$lib/studio/adapters/pla';
  import { progress } from '$lib/state/progress.svelte';
  import { checkFit, pinsOf, type FitInput, type FitOutcome } from './fit/check';

  let { spec }: { spec: FitInput } = $props();

  const blank = untrack(() => (spec.device === 'pla' && spec.blank ? (() => { const p = pinsOf(spec.spec); return blankPla(p.inputs, p.outputs); })() : undefined));
  const studio = new Studio({ device: untrack(() => spec.device), source: untrack(() => progress.draft<string>(spec.id, spec.start ?? '')), fit: blank, auto: true });
  let outcome = $state.raw<FitOutcome | null>(null);
  let showSolution = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let stale = $state(false);

  onMount(() => {
    progress.load();
    const saved = progress.draft<string>(spec.id, '');
    if (saved && saved !== studio.source && !studio.handEdited) studio.setSource(saved);
    return () => {
      clearTimeout(saveTimer);
      studio.destroy();
    };
  });
  $effect(() => {
    const text = studio.source;
    untrack(() => {
      stale = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => progress.saveDraft(spec.id, text), 400);
    });
  });

  function check() {
    // A design typed into the source pane is fitted now (unless the reader has been working by hand on the chip).
    if (!studio.handEdited) studio.fitNow();
    const fit = studio.fit;
    if (!fit || studio.hasErrors) {
      outcome = { pass: false, problems: [], errors: studio.errors.filter((e) => e.severity !== 'warning'), functionOk: false, rows: [], compared: 0, resources: [] };
      stale = false;
      return;
    }
    outcome = checkFit(spec, fit);
    stale = false;
    if (outcome.pass) progress.markSolved(spec.id);
  }

  const fit = $derived(outcome);
</script>

<ExerciseFrame id={spec.id} kind="Fit" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="fitx">
    <div class="studiowrap" data-device={spec.device}>
      <StudioApp {studio} views={spec.views ?? ['source', 'chip', 'report']} compact picker={false} byHand={false} />
    </div>

    <div class="ex-bar ui">
      <button type="button" class="check" onclick={check}><Icon name="check" size={15} /> Check the device</button>
      <button type="button" onclick={() => studio.load({ device: spec.device, source: spec.start ?? '', fit: blank })}>Start again</button>
    </div>

    <div class="out ui">
      {#if fit}
        <Verdict ok={fit.pass}>
          {#if fit.pass}The device does what the specification says, within budget.{:else if fit.errors.length || fit.problems.length}Nothing to check yet: the design has problems.{:else if !fit.functionOk}The device does not match the specification.{:else}It works, but it does not fit the budget.{/if}
          {#if stale}<span class="ex-note"> (you have edited it since)</span>{/if}
        </Verdict>
        {#each fit.errors as e, i (i)}<p class="ex-bad">{e.line > 0 ? `line ${e.line}: ` : ''}{e.message}</p>{/each}
        {#each fit.problems as p (p)}<p class="ex-bad">{p}</p>{/each}
        {#if fit.compared}
          <p class="ex-note">{fit.functionOk ? `Matches the specification on all ${fit.compared.toLocaleString('en-GB')} ${spec.spec.fsm || spec.spec.steps ? 'steps and cycles' : 'input combinations'} tried.` : 'The first things that went wrong:'}</p>
        {/if}
        {#if !fit.functionOk && fit.rows.length}<Mismatch rows={fit.rows} caption="Inputs, what the specification says, and what the device gave" />{/if}
        {#if fit.resources.length}
          <ul class="ex-list res" aria-label="Resources">
            {#each fit.resources as r (r.key)}
              <li class:ok={r.ok}>
                <span class="mark">{r.ok ? '✓' : '✗'}</span> <strong>{r.label}:</strong> <span class="num">{r.used}</span>{#if r.budget !== undefined} <span class="ex-note">(budget {r.budget}){#if !r.ok}, over by {r.used - r.budget}{/if}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if fit.pass && spec.explain}<div class="ex-explain">{@html spec.explain}</div>{/if}
      {/if}
    </div>

    {#if spec.solution}
      <div class="ex-solution ui">
        <button type="button" onclick={() => (showSolution = !showSolution)} aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button>
        {#if showSolution}<pre class="ex-code">{spec.solution}</pre>{/if}
      </div>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .fitx {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .studiowrap {
    height: 34rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    overflow: hidden;
    min-width: 0;
  }
  /* The exercise has one design: the example picker of the source pane would replace it. */
  .studiowrap :global(.pick) {
    display: none;
  }
  @media (max-width: 640px) {
    .studiowrap {
      height: 38rem;
    }
  }
</style>
