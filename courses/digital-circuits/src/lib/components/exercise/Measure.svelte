<!--
  A ```measure block: a live circuit and its instruments, a question, and a box for the value the reader reads off
  ("4.7 k", "2.2 mA"), checked with a tolerance. The expected value is written in the block (`answer`) or read from
  the circuit itself (`probe`), so it cannot drift from the drawing.

    id: ch03/measure-divider
    circuit: 03-the-bench/circuits/divider.json      # a file (relative to content/chapters), or an inline circuit
    question: What is the voltage across R2?
    unit: V
    probe: { voltage: R2.1 }                          # or answer: 2.5
    tolerance: 0.05
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import CircuitWidget from '$lib/bench/CircuitWidget.svelte';
  import Icon from '../ui/Icon.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { checkMeasurement, type MeasureResult } from '$lib/sim/check';
  import { formatSI } from '$lib/bench/format';
  import { expectedValue, type MeasureInput } from './measure/probe';

  let { spec }: { spec: MeasureInput } = $props();

  const uid = $props.id();
  let text = $state(untrack(() => progress.draft<string>(`${spec.id}#answer`, '')));
  let result = $state.raw<MeasureResult | null>(null);
  let tries = $state(0);
  let error = $state('');
  onMount(() => {
    progress.load();
    text = progress.draft<string>(`${spec.id}#answer`, text);
  });

  function check() {
    error = '';
    let want: number;
    try {
      want = expectedValue(spec, spec.circuit);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return;
    }
    progress.saveDraft(`${spec.id}#answer`, text);
    result = checkMeasurement(text, want, spec.tolerance ?? 0.05);
    tries++;
    if (result.pass) progress.markSolved(spec.id);
  }
  const tol = $derived(typeof spec.tolerance === 'number' || spec.tolerance === undefined ? `${Math.round((spec.tolerance ?? 0.05) * 100)} %` : [spec.tolerance.rel !== undefined ? `${Math.round(spec.tolerance.rel * 100)} %` : '', spec.tolerance.abs !== undefined ? `${spec.tolerance.abs}` : ''].filter(Boolean).join(' or '));
</script>

<ExerciseFrame id={spec.id} kind="Measure" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  {#if spec.circuit}
    <CircuitWidget circuit={spec.circuit} title={spec.title ?? 'Measure it'} mode={spec.mode} traces={spec.traces} current={spec.current} speed={spec.speed ?? 1} />
  {/if}
  <form
    class="ask ui"
    onsubmit={(e) => {
      e.preventDefault();
      check();
    }}
  >
    {#if spec.question}<label for="{uid}-a" class="q">{@html spec.question}</label>{/if}
    <div class="row">
      <input id="{uid}-a" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder={spec.unit ? `e.g. 4.7 ${spec.unit}` : 'e.g. 4.7 k'} bind:value={text} aria-describedby="{uid}-tol" />
      {#if spec.unit}<span class="unit">{spec.unit}</span>{/if}
      <button type="submit" class="check"><Icon name="check" size={15} /> Check</button>
    </div>
    <p id="{uid}-tol" class="tol">Within {tol}. Type the unit prefix if you like: <code>4.7 k</code>, <code>2.2 mA</code>, <code>150 µ</code>.</p>
  </form>
  <div class="res ui" role="status" aria-live="polite">
    {#if error}
      <p class="bad">{error}</p>
    {:else if result}
      <p class:ok={result.pass} class:bad={!result.pass}>
        <strong>{result.pass ? '✓' : '✗'} {result.message}</strong>
        {#if result.pass && result.value !== undefined} You read {formatSI(result.value, spec.unit ?? '')}.{/if}
      </p>
      {#if result.pass && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
    {/if}
  </div>
</ExerciseFrame>

<style>
  .ask {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
  }
  .q {
    display: block;
    font-weight: 700;
    margin-bottom: 0.4rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  input {
    font: inherit;
    font-family: var(--font-mono);
    padding: 0.4rem 0.6rem;
    min-height: 2.4rem;
    width: min(14rem, 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink);
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .unit {
    font-family: var(--font-mono);
    color: var(--ink-3);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
    border-radius: var(--radius-sm);
    padding: 0.35rem 1rem;
    font: inherit;
    font-weight: 700;
    min-height: 2.4rem;
    cursor: pointer;
  }
  .check:hover {
    background: var(--copper);
    color: var(--on-accent, #fff);
  }
  .tol {
    margin: 0.35rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-3);
  }
  .res p {
    margin: 0.5rem 0 0;
    padding: 0.4rem 0.7rem;
    border-left: 3px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  .res p.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .res p.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .explain {
    margin-top: 0.5rem;
    padding: 0.5rem 0.8rem 0.1rem;
    border-left: 3px solid var(--ok);
    background: var(--surface-2);
    font-family: var(--font-body);
    font-size: 0.98rem;
  }
</style>
