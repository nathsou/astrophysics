<!--
  Find the bad step. A hand-written "refutation" of a formula: one step is not a correct resolution. The reader
  clicks the step they think is wrong; the step checker then checks every step and the honest solver looks for a
  model. Steps are written with 1-based clause numbers: { from: [i, j], on: v, clause: [...] }.
-->
<script lang="ts">
  import { checkStep } from '$lib/fv/sat/resolution';
  import { solveCnf } from '$lib/fv/sat/solver';
  import { progress } from '$lib/state/progress.svelte';

  let {
    clauses,
    steps,
    names,
    id,
    title,
    caption,
  }: { clauses: number[][]; steps: { from: [number, number]; on: number; clause: number[] }[]; names?: string[]; id?: string; title?: string; caption?: string } = $props();

  const name = (v: number) => names?.[v] ?? `x${v}`;
  const litText = (l: number) => `${l < 0 ? '¬' : ''}${name(Math.abs(l))}`;
  const clauseText = (c: readonly number[]) => (c.length ? c.map(litText).join(' ∨ ') : '∅');

  // svelte-ignore state_referenced_locally
  const all = [...clauses, ...steps.map((s) => s.clause)];
  // svelte-ignore state_referenced_locally
  const verdicts = steps.map((s, k) => checkStep(all.slice(0, clauses.length + k), { left: s.from[0] - 1, right: s.from[1] - 1, pivot: s.on, clause: s.clause }));
  const bad = verdicts.findIndex((v) => v !== undefined);
  // svelte-ignore state_referenced_locally
  const nvars = Math.max(...all.flat().map(Math.abs));
  // svelte-ignore state_referenced_locally
  const solved = solveCnf({ nvars, clauses });

  let choice = $state<number | undefined>();
  let revealed = $state(false);
  function check() {
    revealed = true;
    if (choice === bad && id) progress.markSolved(id);
  }
</script>

<figure class="bad">
  {#if title}<p class="ui t">{title}</p>{/if}
  <ol class="ui">
    {#each clauses as c, i (i)}<li><span class="n">{i + 1}</span><code>{clauseText(c)}</code><span class="from">input</span></li>{/each}
    {#each steps as s, k (k)}
      <li class="step" class:chosen={choice === k} class:wrong={revealed && verdicts[k]} class:right={revealed && !verdicts[k]}>
        <label>
          <input type="radio" name={id ?? 'badstep'} value={k} bind:group={choice} disabled={revealed} />
          <span class="n">{clauses.length + k + 1}</span><code>{clauseText(s.clause)}</code><span class="from">from {s.from[0]} and {s.from[1]} on {name(s.on)}</span>
        </label>
        {#if revealed && verdicts[k]}<p class="why">{verdicts[k]}</p>{/if}
      </li>
    {/each}
  </ol>
  <div class="bar ui">
    <button type="button" onclick={check} disabled={choice === undefined || revealed}>Check every step</button>
    {#if revealed}<button type="button" onclick={() => { revealed = false; choice = undefined; }}>Try again</button>{/if}
  </div>
  {#if revealed}
    <p class="ui verdict" class:good={choice === bad}>
      {choice === bad ? 'Right, that is the bad step.' : `Not that one: step ${clauses.length + (choice ?? 0) + 1} is a correct resolution. The bad step is ${clauses.length + bad + 1}.`}
      {#if solved.result === 'sat'}And the formula is in fact satisfiable: {Array.from({ length: nvars }, (_, i) => litText(solved.model[i + 1] ? i + 1 : -(i + 1))).join(', ')} satisfies every input clause. One bad step was enough to "prove" something false.{/if}
    </p>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .bad {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .t {
    margin: 0 0 0.5rem;
    font-weight: 700;
    font-size: 0.9rem;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    font-size: 0.86rem;
  }
  li,
  label {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }
  li {
    padding: 0.25rem 0.6rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  li.step {
    flex-direction: column;
    gap: 0.1rem;
    border-style: dashed;
  }
  label {
    width: 100%;
    cursor: pointer;
  }
  li.chosen {
    border-color: var(--ink-blue);
    border-style: solid;
  }
  li.wrong {
    border-color: var(--pencil);
    border-style: solid;
    background: color-mix(in srgb, var(--pencil) 8%, var(--panel));
  }
  .n {
    min-width: 1.4rem;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  code {
    font-family: var(--font-mono);
  }
  .from {
    margin-left: auto;
    font-size: 0.76rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .why {
    margin: 0 0 0 3.4rem;
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .bar {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .bar button {
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.28rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .bar button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .verdict {
    margin: 0.6rem 0 0;
    font-size: 0.88rem;
    color: var(--pencil);
  }
  .verdict.good {
    color: var(--seal);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  @media (max-width: 520px) {
    label {
      flex-wrap: wrap;
    }
  }
</style>
