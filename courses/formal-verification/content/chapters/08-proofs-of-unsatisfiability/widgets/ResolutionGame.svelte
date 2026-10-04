<!--
  Derive the empty clause by hand. Click two clauses that clash on exactly one variable and their resolvent is
  added below, with where it came from. Clauses that clash on two variables give a tautology (useless), and the
  widget says so. Deriving the empty clause is a refutation: the input is unsatisfiable.
-->
<script lang="ts">
  import { clashes, resolve, sameClause } from '$lib/fv/sat/resolution';
  import { progress } from '$lib/state/progress.svelte';

  let { clauses, names, id, caption }: { clauses: number[][]; names?: string[]; id?: string; caption?: string } = $props();

  const name = (v: number) => names?.[v] ?? `x${v}`;
  const litText = (l: number) => `${l < 0 ? '¬' : ''}${name(Math.abs(l))}`;
  const clauseText = (c: readonly number[]) => (c.length ? c.map(litText).join(' ∨ ') : '∅ (the empty clause)');

  type Row = { clause: number[]; from?: [number, number, number] };
  // svelte-ignore state_referenced_locally
  const input: Row[] = clauses.map((c) => ({ clause: [...c] }));
  let rows = $state<Row[]>(input.map((r) => ({ ...r })));
  let picked = $state<number[]>([]);
  let message = $state('Pick two clauses.');
  let done = $state(false);

  function pick(i: number) {
    if (done) return;
    if (picked.includes(i)) {
      picked = picked.filter((j) => j !== i);
      return;
    }
    picked = [...picked, i].slice(-2);
    if (picked.length < 2) {
      message = 'Pick a second clause.';
      return;
    }
    const [a, b] = picked as [number, number];
    const A = rows[a]!.clause;
    const B = rows[b]!.clause;
    const vs = clashes(A, B);
    if (vs.length === 0) {
      message = `Clauses ${a + 1} and ${b + 1} do not clash on any variable (no literal in one is negated in the other), so there is nothing to resolve on.`;
    } else if (vs.length > 1) {
      message = `Clauses ${a + 1} and ${b + 1} clash on ${vs.map(name).join(' and ')}. Resolving on one leaves the other as both ${name(vs[1]!)} and ¬${name(vs[1]!)}: a tautology, true in every assignment and useless for a refutation.`;
    } else {
      const r = resolve(A, B, vs[0]!);
      const dup = rows.findIndex((x) => sameClause(x.clause, r));
      if (dup >= 0) message = `The resolvent, ${clauseText(r)}, is already clause ${dup + 1}.`;
      else {
        rows = [...rows, { clause: r, from: [a, b, vs[0]!] }];
        message = `Resolved clauses ${a + 1} and ${b + 1} on ${name(vs[0]!)}: added clause ${rows.length}, ${clauseText(r)}.`;
        if (r.length === 0) {
          done = true;
          message = `The empty clause: no assignment satisfies it, and every step preserved satisfiability, so no assignment satisfies the input. A refutation in ${rows.length - input.length} steps.`;
          if (id) progress.markSolved(id);
        }
      }
    }
    picked = [];
  }
  function undo() {
    if (rows.length > input.length) rows = rows.slice(0, -1);
    done = false;
    picked = [];
    message = 'Pick two clauses.';
  }
  function reset() {
    rows = input.map((r) => ({ ...r }));
    done = false;
    picked = [];
    message = 'Pick two clauses.';
  }
</script>

<figure class="rg">
  <ol class="ui">
    {#each rows as r, i (i)}
      <li class:derived={i >= input.length} class:empty={r.clause.length === 0}>
        <button type="button" class:on={picked.includes(i)} onclick={() => pick(i)} disabled={done} aria-pressed={picked.includes(i)}>
          <span class="n">{i + 1}</span>
          <code>{clauseText(r.clause)}</code>
          {#if r.from}<span class="from">from {r.from[0] + 1} and {r.from[1] + 1} on {name(r.from[2])}</span>{:else}<span class="from">input</span>{/if}
        </button>
      </li>
    {/each}
  </ol>
  <p class="msg ui" class:good={done} role="status">{message}</p>
  <div class="bar ui">
    <button type="button" onclick={undo} disabled={rows.length === input.length}>Undo</button>
    <button type="button" onclick={reset}>Reset</button>
    <span>{rows.length - input.length} step{rows.length - input.length === 1 ? '' : 's'}</span>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .rg {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
  }
  li button {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    text-align: left;
    font: inherit;
    font-size: 0.86rem;
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  li button:disabled {
    cursor: default;
  }
  li button.on {
    border-color: var(--ink-blue);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ink-blue) 30%, transparent);
  }
  li.derived button {
    border-style: dashed;
  }
  li.empty button {
    border-color: var(--seal);
    background: var(--seal-soft);
  }
  .n {
    min-width: 1.6rem;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
  .from {
    margin-left: auto;
    color: var(--mute);
    font-size: 0.76rem;
    white-space: nowrap;
  }
  .msg {
    margin: 0.7rem 0 0.4rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .msg.good {
    color: var(--seal);
    font-weight: 600;
  }
  .bar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .bar button {
    font: inherit;
    cursor: pointer;
    padding: 0.22rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .bar button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  @media (max-width: 520px) {
    li button {
      flex-wrap: wrap;
    }
    .from {
      margin-left: 2.2rem;
    }
  }
</style>
