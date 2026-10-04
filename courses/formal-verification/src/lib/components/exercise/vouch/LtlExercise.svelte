<!--
  `ltl` exercises: write a temporal formula for an English requirement. It is checked against a bank of lasso
  traces, each labelled with whether the requirement holds on it; a formula that disagrees on any trace is wrong,
  and the trace it disagrees on is the explanation.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import { parseProp } from '$lib/fv/ltl/props';
  import { evalLasso } from '$lib/fv/ltl/ltl';
  import { progress } from '$lib/state/progress.svelte';

  interface BankTrace {
    name?: string;
    states: string[][];
    loop: number;
    holds: boolean;
    why?: string;
  }
  interface Spec {
    id: string;
    title?: string;
    prompt?: string;
    props: string[];
    starter?: string;
    traces: BankTrace[];
    solution?: string;
    hints?: string[];
    success?: string;
  }
  let { spec }: { spec: Spec } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(spec.starter ?? '');
  let error = $state('');
  let results = $state<{ t: BankTrace; got: boolean }[]>([]);
  let solved = $state(false);
  let showSolution = $state(false);

  onMount(() => {
    const d = progress.draft<string | undefined>(spec.id, undefined);
    if (d) text = d;
  });

  function check() {
    progress.saveDraft(spec.id, text);
    error = '';
    results = [];
    solved = false;
    const f = parseProp(text, spec.props);
    if ('error' in f) {
      error = f.error;
      return;
    }
    results = spec.traces.map((t) => ({ t, got: evalLasso(f.ltl, t.states.length, t.loop, (i, a) => t.states[i]!.includes(f.props[a]!)) }));
    if (results.every((r) => r.got === r.t.holds)) {
      solved = true;
      progress.markSolved(spec.id);
    }
  }

  const show = (t: BankTrace) => t.states.map((s, i) => `${i === t.loop ? '↺ ' : ''}{${s.join(', ')}}`).join(' → ') + ` → back to ${t.loop}`;
</script>

<ExerciseFrame id={spec.id} kind="write the formula" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <form class="f ui" onsubmit={(e) => { e.preventDefault(); check(); }}>
    <input bind:value={text} spellcheck="false" aria-label="Your formula" placeholder="always (…)" />
    <button type="submit" class="go">Check against the traces</button>
    {#if spec.solution}<button type="button" onclick={() => (showSolution = !showSolution)}>{showSolution ? 'Hide' : 'Show a solution'}</button>{/if}
  </form>
  <p class="props ui">Propositions: {#each spec.props as p (p)}<code>{p}</code> {/each}· operators: <code>!</code> <code>&&</code> <code>||</code> <code>==></code> <code>always</code> <code>eventually</code> <code>next</code> <code>until</code> <code>~></code></p>
  {#if showSolution && spec.solution}<p class="sol"><code>{spec.solution}</code></p>{/if}
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if results.length}
    <ul class="bank">
      {#each results as r, i (i)}
        <li class:ok={r.got === r.t.holds}>
          <span class="mark ui">{r.got === r.t.holds ? '✓' : '✗'}</span>
          <div>
            <code class="trace">{show(r.t)}</code>
            <p>The requirement {r.t.holds ? 'holds' : 'fails'} on this trace; your formula says it {r.got ? 'holds' : 'fails'}.{#if r.got !== r.t.holds && r.t.why} {r.t.why}{/if}</p>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#if solved}<div class="success" role="status"><strong class="ui">Every trace agrees.</strong> {#if spec.success}{@html spec.success}{/if}</div>{/if}
</ExerciseFrame>

<style>
  .f {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  input {
    flex: 1;
    min-width: 14rem;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--code-bg);
    color: var(--fg);
  }
  button {
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.3rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .props {
    font-size: 0.78rem;
    color: var(--mute);
    margin: 0.4rem 0;
  }
  .err {
    color: var(--pencil);
  }
  .bank {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .bank li {
    display: grid;
    grid-template-columns: 1.3rem minmax(0, 1fr);
    gap: 0.3rem;
  }
  .bank p {
    margin: 0.15rem 0 0;
    font-size: 0.92rem;
  }
  .mark {
    color: var(--pencil);
    font-weight: 800;
  }
  li.ok .mark {
    color: var(--seal);
  }
  li:not(.ok) p {
    color: var(--pencil);
  }
  .trace {
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }
  .success {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--seal) 45%, var(--line));
    background: var(--seal-soft);
    border-radius: var(--radius-sm);
  }
</style>
