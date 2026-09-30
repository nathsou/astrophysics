<!-- Find the faulty line in a flawed "proof". -->
<script lang="ts">
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    lines: string[];
    /** Index (0-based) of the faulty line, or several acceptable ones. */
    wrong: number | number[];
    why: string;
    /** Optional comments on lines that are fine: { "2": "…" }. */
    notes?: Record<string, string>;
  }
  let { spec }: { spec: Spec } = $props();

  const wrong = $derived(Array.isArray(spec.wrong) ? spec.wrong : [spec.wrong]);
  let picked = $state<number | null>(null);
  let found = $state(false);
  let tries = $state(0);

  function pick(i: number) {
    if (found) return;
    picked = i;
    tries++;
    if (wrong.includes(i)) {
      found = true;
      progress.markSolved(spec.id);
    }
  }
</script>

<ExerciseFrame id={spec.id} kind="Spot the bug" title={spec.title} prompt={spec.prompt ?? '<p>This “proof” reaches a false conclusion. Click the first line that does not follow.</p>'} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])}>
  <ol class="lines">
    {#each spec.lines as l, i (i)}
      <li>
        <button class="line" class:bad={found && wrong.includes(i)} class:fine={picked === i && !wrong.includes(i)} onclick={() => pick(i)} disabled={found}>
          <span class="n ui">{i + 1}</span>
          <span class="t">{@html l}</span>
        </button>
      </li>
    {/each}
  </ol>
  {#if found}
    <div class="why"><p class="ui head">✓ Found it{tries > 1 ? ` (after ${tries} tries)` : ''}.</p>{@html spec.why}</div>
  {:else if picked !== null}
    <p class="ui miss">Line {picked + 1} is fine{spec.notes?.[String(picked)] ? ':' : '.'} {#if spec.notes?.[String(picked)]}{@html spec.notes[String(picked)]}{:else}Keep looking.{/if}</p>
  {/if}
</ExerciseFrame>

<style>
  .lines {
    list-style: none;
    padding: 0;
    margin: 0 0 0.6rem !important;
    display: grid;
    gap: 0.3rem;
  }
  li {
    margin: 0 !important;
  }
  .line {
    display: grid;
    grid-template-columns: 1.6rem 1fr;
    width: 100%;
    text-align: left;
    align-items: baseline;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.98rem;
  }
  .line:hover:not(:disabled) {
    background: var(--pn);
    border-color: var(--bad);
  }
  .line:disabled {
    cursor: default;
    color: var(--ink);
  }
  .line.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .line.fine {
    border-color: var(--ok);
  }
  .t :global(p) {
    margin: 0;
  }
  .n {
    font-size: 0.75rem;
    color: var(--ink-3);
  }
  .why {
    padding: 0.6rem 0.9rem 0.1rem;
    border-radius: var(--radius-sm);
    background: var(--ok-soft);
    border-left: 3px solid var(--ok);
  }
  .why :global(p) {
    margin: 0 0 0.6rem;
  }
  .head {
    color: var(--ok);
    font-weight: 650;
    font-size: 0.88rem;
  }
  .miss {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .miss :global(p) {
    display: inline;
  }
</style>
