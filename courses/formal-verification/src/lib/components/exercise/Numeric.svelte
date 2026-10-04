<!--
  A numeric answer, checked within a tolerance. Used for calculations and Fermi estimates.
  Spec: { id, title, prompt, answer (number), unit?, tolerance? (relative, default 0.02), factor? (accept within a
  factor of this many, for Fermi estimates), explain?, hints?, solution? }.
  `fermi` accepts any answer within a factor of 3 by default.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    answer: number;
    unit?: string;
    tolerance?: number;
    factor?: number;
    /** true when the block was written as ```fermi */
    fermi?: boolean;
  }
  let { spec }: { spec: Spec } = $props();

  let text = $state('');
  let verdict = $state<{ ok: boolean; msg: string } | null>(null);

  onMount(() => {
    progress.load();
    text = progress.draft<string>(spec.id, '');
  });

  function parse(s: string): number {
    // Accept 1.5e-3, 1.5×10^-3, 1.5 x 10^-3, 3,000 and a trailing unit.
    const t = s.trim().replace(/,/g, '').replace(/[×x*]\s*10\s*\^?\s*(-?\d+)/i, 'e$1').replace(/\s*[a-zA-Zµμ°/]+.*$/, '');
    return Number(t);
  }
  function check() {
    progress.saveDraft(spec.id, text);
    const v = parse(text);
    if (!Number.isFinite(v)) {
      verdict = { ok: false, msg: 'Enter a number (for example 3.2e-5).' };
      return;
    }
    const a = spec.answer;
    const factor = spec.factor ?? (spec.fermi ? 3 : undefined);
    let ok: boolean;
    if (factor !== undefined) ok = v > 0 && a !== 0 && v / a <= factor && a / v <= factor;
    else ok = a === 0 ? Math.abs(v) < 1e-12 : Math.abs(v - a) / Math.abs(a) <= (spec.tolerance ?? 0.02);
    verdict = ok
      ? { ok, msg: factor !== undefined ? `Within a factor of ${factor} of ${fmt(a)}${spec.unit ? ' ' + spec.unit : ''}.` : 'Correct.' }
      : { ok, msg: v > a ? 'Too large.' : 'Too small.' };
    if (ok) progress.markSolved(spec.id);
  }
  const fmt = (x: number) => Number(x.toPrecision(3)).toString();
</script>

<ExerciseFrame id={spec.id} kind={spec.fermi ? 'Fermi estimate' : 'Calculate'} title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={spec.solution}>
  <form class="ui" onsubmit={(e) => { e.preventDefault(); check(); }}>
    <label>
      <span class="sr">Your answer</span>
      <input bind:value={text} inputmode="decimal" placeholder="your answer" autocomplete="off" />
    </label>
    {#if spec.unit}<span class="unit">{spec.unit}</span>{/if}
    <button type="submit">Check</button>
  </form>
  {#if verdict}<Verdict ok={verdict.ok}>{verdict.msg}</Verdict>{#if verdict.ok && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}{/if}
</ExerciseFrame>

<style>
  form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  input {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink);
    width: 12rem;
  }
  .unit {
    font-family: var(--font-mono);
    color: var(--mute);
  }
  button {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 6px;
    padding: 0.35rem 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .sr {
    position: absolute;
    left: -9999px;
  }
  .explain {
    margin-top: 0.5rem;
    font-size: 0.92rem;
  }
</style>
