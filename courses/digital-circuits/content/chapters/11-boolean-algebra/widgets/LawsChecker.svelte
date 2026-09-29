<!--
  The laws checker: type two Boolean expressions and see whether they are the same function. The checker
  tries every row of the truth table (perfect induction) and shows the first row where they differ.
  Operators: ! ~ ' for NOT, & · * for AND, | + for OR, ^ for XOR; brackets. Logic in laws.ts.

    ::laws-checker{n="11.1" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { LAWS, checkLaws } from './laws';

  let { n, caption, left: l0 = 'A + B·C', right: r0 = '(A + B)·(A + C)' }: { n?: string | number; caption?: string; left?: string; right?: string } = $props();

  let left = $state(untrack(() => l0));
  let right = $state(untrack(() => r0));
  let lawId = $state<string>('dist2');
  const result = $derived(checkLaws(left, right));
  const law = $derived(LAWS.find((x) => x.id === lawId));

  function pick(id: string) {
    const x = LAWS.find((y) => y.id === id)!;
    lawId = id;
    left = x.left;
    right = x.right;
  }
  function edited() {
    lawId = '';
  }
  const bits = (env: Record<string, number>, vars: string[]) => vars.map((v) => `${v} = ${env[v]}`).join(', ');
</script>

<Widget title="Laws checker" {n} {caption} onreset={() => pick('dist2')}>
  {#snippet controls()}
    <Segmented size="sm" label="Known laws" value={lawId} onchange={pick} options={LAWS.map((x) => ({ value: x.id, label: x.name }))} />
  {/snippet}

  <div class="lc ui">
    <div class="inputs">
      <label>
        <span class="side">Left</span>
        <input type="text" bind:value={left} oninput={edited} spellcheck="false" autocomplete="off" autocapitalize="off" aria-invalid={!result.ok && result.side !== 'right'} aria-label="Left expression" />
      </label>
      <span class="eq" class:ok={result.ok && result.equal} class:bad={result.ok && !result.equal} aria-hidden="true">{result.ok ? (result.equal ? '=' : '≠') : '?'}</span>
      <label>
        <span class="side">Right</span>
        <input type="text" bind:value={right} oninput={edited} spellcheck="false" autocomplete="off" autocapitalize="off" aria-invalid={!result.ok && result.side !== 'left'} aria-label="Right expression" />
      </label>
    </div>

    {#if !result.ok}
      <p class="verdict warn" role="status">
        {#if result.side !== 'both'}<b>{result.side === 'left' ? 'Left side' : 'Right side'}:</b>{/if}
        {result.message}
        <span class="syntax">Use <code>!</code> for NOT, <code>&amp;</code> or <code>·</code> for AND, <code>|</code> or <code>+</code> for OR, <code>^</code> for XOR.</span>
      </p>
    {:else}
      <p class="verdict" class:ok={result.equal} class:bad={!result.equal} role="status">
        {#if result.equal}
          <b>Equal.</b> All {result.rows.length} rows agree, so the two sides are the same function{#if law && lawId}{' '}({law.name}){/if}.
        {:else}
          <b>Not equal.</b> They differ on {result.differing} of {result.rows.length} rows. For {bits(result.counterexample!.env, result.vars)} the left side is {result.counterexample!.left} and the right side is {result.counterexample!.right}.
        {/if}
      </p>
      {#if law && lawId}<p class="note">{law.note}</p>{/if}

      <div class="scroll">
        <table>
          <thead>
            <tr>
              {#each result.vars as v (v)}<th>{v}</th>{/each}
              <th class="o">left</th>
              <th class="o">right</th>
            </tr>
          </thead>
          <tbody>
            {#each result.rows as r (r.m)}
              <tr class:diff={r.left !== r.right}>
                {#each result.vars as v (v)}<td>{r.env[v]}</td>{/each}
                <td class="o" class:one={r.left}>{r.left}</td>
                <td class="o" class:one={r.right}>{r.right}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="min">
        Smallest sum of products: left <code>{result.minimal.left}</code>{#if result.minimal.left !== result.minimal.right}, right <code>{result.minimal.right}</code>{:else}, and so is the right{/if}.
      </p>
    {/if}
  </div>
</Widget>

<style>
  .lc {
    display: grid;
    gap: 0.7rem;
  }
  .inputs {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 0.6rem;
    align-items: end;
  }
  @media (max-width: 36rem) {
    .inputs {
      grid-template-columns: minmax(0, 1fr);
    }
    .eq {
      justify-self: center;
    }
  }
  label {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }
  .side {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  input {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    min-width: 0;
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  input[aria-invalid='true'] {
    border-color: var(--bad);
  }
  .eq {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--mute);
    padding-bottom: 0.2rem;
    min-width: 1.6rem;
    text-align: center;
  }
  .eq.ok {
    color: var(--ok);
  }
  .eq.bad {
    color: var(--bad);
  }
  .verdict {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.88rem;
    line-height: 1.5;
    background: var(--pn);
  }
  .verdict.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .verdict.bad {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .verdict.warn {
    background: var(--maybe-soft);
    color: var(--maybe);
  }
  .syntax {
    display: block;
    margin-top: 0.2rem;
    color: var(--ink-2);
    font-size: 0.8rem;
  }
  code {
    font-family: var(--font-mono);
  }
  .note,
  .min {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .scroll {
    max-height: 16rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-align: center;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--pn);
    color: var(--mute);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.5rem;
  }
  td {
    padding: 0.15rem 0.5rem;
    border-top: 1px solid var(--line);
  }
  .o {
    border-left: 1px solid var(--line);
    color: var(--sig-low);
    font-weight: 700;
  }
  .o.one {
    color: var(--sig-high);
  }
  tr.diff td {
    background: var(--bad-soft);
  }
  tr.diff .o {
    color: var(--bad);
  }
</style>
