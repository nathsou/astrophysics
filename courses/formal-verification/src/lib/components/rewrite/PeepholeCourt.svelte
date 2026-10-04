<!--
  The peephole court (chapter 14): propose a rewrite `lhs => rhs if pre` over machine integers and get a verdict at
  each width. A refutation shows its counterexample in binary, hex and decimal; a proof shows whether its
  certificate has been checked; each width shows the size of the bit-blasted circuits.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { runCourt } from './court';
  import { showValue, type WidthVerdict } from '$lib/fv/rewrite/peephole';

  let {
    rewrite,
    docket = [],
    widths = [8, 16, 32, 64],
    timeout = 6000,
    caption,
  }: { rewrite: string; docket?: string[]; widths?: number[]; timeout?: number; caption?: string } = $props();

  type Row = { verdict?: Omit<WidthVerdict, 'proof'>; size?: { lhs: number; rhs: number }; certified?: boolean };
  // svelte-ignore state_referenced_locally
  let text = $state(rewrite);
  let rows = $state<Record<number, Row>>({});
  let error = $state('');
  let running = $state(false);
  let selected = $state<number | undefined>();
  let cancel: (() => void) | undefined;

  function rule() {
    cancel?.();
    rows = {};
    error = '';
    selected = undefined;
    running = true;
    cancel = runCourt({ text, widths, timeout }, (e) => {
      if (e.kind === 'width') {
        rows[e.verdict.width] = { verdict: e.verdict, size: e.size };
        if (selected === undefined && e.verdict.status === 'refuted') selected = e.verdict.width;
      } else if (e.kind === 'certified') rows[e.width] = { ...rows[e.width], certified: e.ok };
      else if (e.kind === 'error') error = e.message;
      else running = false;
    });
  }
  onMount(rule);
  onDestroy(() => cancel?.());

  const maxGates = $derived(Math.max(1, ...Object.values(rows).map((r) => (r.size ? r.size.lhs + r.size.rhs : 0))));
  const cex = $derived(selected !== undefined ? rows[selected]?.verdict?.counterexample : undefined);
  const label = (r: Row) => {
    const s = r.verdict?.status;
    return s === 'proved' ? 'Proved' : s === 'refuted' ? 'Refuted' : s === 'vacuous' ? 'Vacuous' : s === 'unknown' ? 'Unknown' : 'Deliberating…';
  };
  const glyph = (r: Row) => {
    const s = r.verdict?.status;
    return s === 'proved' ? '✓' : s === 'refuted' ? '✗' : s === 'vacuous' ? '∅' : s === 'unknown' ? '?' : '…';
  };
  const show = (x: bigint | boolean, w: number) => showValue(x, w);
</script>

<figure class="court">
  <div class="top">
    <label class="ui lab" for="court-input">Rewrite (left => right, optionally “if precondition”)</label>
    <div class="line">
      <input id="court-input" class="code" bind:value={text} spellcheck="false" autocomplete="off" onkeydown={(e) => e.key === 'Enter' && rule()} />
      <button type="button" class="go ui" onclick={rule}>Rule</button>
    </div>
    {#if docket.length}
      <div class="docket ui">
        <span class="dl">Docket:</span>
        {#each docket as d (d)}<button type="button" class="chip" class:on={d === text} onclick={() => ((text = d), rule())}><code>{d}</code></button>{/each}
      </div>
    {/if}
    {#if error}<p class="err ui">{error}</p>{/if}
  </div>

  {#if !error}
    <div class="widths">
      {#each widths as w (w)}
        {@const r = rows[w] ?? {}}
        {@const s = r.verdict?.status}
        <button type="button" class="card {s ?? 'pending'}" class:sel={selected === w} disabled={s !== 'refuted'} onclick={() => (selected = w)} aria-label="{w} bits: {label(r)}">
          <span class="w ui">{w} bits</span>
          <span class="stamp"><span class="g" aria-hidden="true">{glyph(r)}</span> {label(r)}</span>
          <span class="meta ui">
            {#if s === 'proved' || s === 'vacuous'}
              {r.certified === undefined ? 'checking the certificate…' : r.certified ? 'certificate checked' : 'certificate REJECTED'}
            {:else if s === 'refuted'}counterexample replayed{:else if s === 'unknown'}{r.verdict?.reason}{:else}{running ? 'bit-blasting and solving' : ''}{/if}
          </span>
          {#if r.verdict}<span class="meta ui">{r.verdict.conflicts.toLocaleString('en-GB')} conflicts · {r.verdict.ms.toLocaleString('en-GB')} ms</span>{/if}
          {#if r.size}
            <span class="gates ui" title="Gates in the bit-blasted circuits of the two sides">
              <span class="bar"><span style="width: {Math.max(2, (100 * Math.log1p(r.size.lhs + r.size.rhs)) / Math.log1p(maxGates))}%"></span></span>
              {(r.size.lhs + r.size.rhs).toLocaleString('en-GB')} gates
            </span>
          {/if}
        </button>
      {/each}
    </div>

    {#if cex && selected !== undefined}
      {@const w = selected}
      <div class="cex">
        <h4 class="ui">Counterexample at {w} bits</h4>
        <table>
          <tbody>
            {#each cex.inputs as [name, x] (name)}
              {@const s = show(x, w)}
              <tr><th><code>{name}</code></th><td class="bin"><code>{s.bin}</code></td><td><code>{s.hex}</code></td><td class="dec">{s.dec}</td></tr>
            {/each}
            {#each [['left side', cex.lhs], ['right side', cex.rhs]] as const as [name, val] (name)}
              {@const s = show(val.v, w)}
              <tr class="out">
                <th class="ui">{name}</th>
                {#if !val.defined}<td colspan="3" class="ub ui">undefined behaviour (division by zero, signed overflow in division, or a shift by the width or more)</td>
                {:else if typeof val.v === 'boolean'}<td colspan="3"><code>{val.v}</code></td>
                {:else}<td class="bin"><code>{s.bin}</code></td><td><code>{s.hex}</code></td><td class="dec">{s.dec}</td>{/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  <details class="syntax ui">
    <summary>Syntax</summary>
    <p>Variables are names (<code>x</code>, <code>y</code>, <code>C1</code>); every variable ranges over all values of the width. Operators: <code>+ - * & | ^ ~</code> and unary <code>-</code>; <code>&lt;&lt;</code>; division, remainder, right shift and comparisons come in unsigned and signed versions: <code>/u /s %u %s &gt;&gt;u &gt;&gt;s &lt;u &lt;=u &gt;u &gt;=u &lt;s &lt;=s &gt;s &gt;=s</code>, and <code>== !=</code>. Conditions combine with <code>&& || !</code>. Constants: <code>width</code>, <code>UMAX</code>, <code>SMAX</code>, <code>SMIN</code>, <code>true</code>, <code>false</code>; <code>pow2(C)</code> says C is a power of two.</p>
    <p>Undefined behaviour, as in LLVM: division or remainder by zero, <code>SMIN /s -1</code>, and shifts by the width or more. A rewrite only has to be correct where the left side is defined, and the right side must be defined there too. The court is simpler than Alive: it has no poison values and no <code>nsw</code> or <code>nuw</code> flags.</p>
  </details>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .court {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .lab {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
    margin-bottom: 0.3rem;
  }
  .line {
    display: flex;
    gap: 0.4rem;
  }
  input.code {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  button {
    font-family: var(--font-ui);
    cursor: pointer;
  }
  .go {
    padding: 0.3rem 0.9rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .docket {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.8rem;
  }
  .dl {
    color: var(--ink-2);
    font-weight: 600;
  }
  .chip {
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .chip.on {
    border-color: var(--ink-blue);
    background: color-mix(in srgb, var(--ink-blue) 10%, var(--panel));
  }
  .chip code {
    font-size: 0.74rem;
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .widths {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    text-align: left;
    padding: 0.55rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .card:disabled {
    cursor: default;
  }
  .card.sel {
    outline: 2px solid var(--pencil);
    outline-offset: 1px;
  }
  .w {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .stamp {
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 1rem;
  }
  .proved .stamp {
    color: var(--seal);
  }
  .refuted .stamp {
    color: var(--pencil);
  }
  .unknown .stamp,
  .vacuous .stamp {
    color: var(--gold);
  }
  .pending .stamp {
    color: var(--mute);
  }
  .meta {
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .gates {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .bar {
    display: block;
    height: 4px;
    background: var(--line);
    border-radius: 2px;
    margin: 0.15rem 0;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--ink-blue);
    border-radius: 2px;
  }
  .cex {
    margin-top: 0.8rem;
    overflow-x: auto;
  }
  .cex h4 {
    margin: 0 0 0.3rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pencil);
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    margin: 0;
  }
  th,
  td {
    padding: 0.2rem 0.6rem 0.2rem 0;
    text-align: left;
    vertical-align: baseline;
    white-space: nowrap;
  }
  tr.out th,
  tr.out td {
    border-top: 1px solid var(--line);
  }
  td.bin code {
    letter-spacing: 0.02em;
  }
  .dec {
    color: var(--ink-2);
  }
  .ub {
    color: var(--pencil);
    white-space: normal;
  }
  code {
    font-family: var(--font-mono);
  }
  .syntax {
    margin-top: 0.8rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .syntax summary {
    cursor: pointer;
    font-weight: 600;
  }
  .syntax code {
    font-size: 0.78rem;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
