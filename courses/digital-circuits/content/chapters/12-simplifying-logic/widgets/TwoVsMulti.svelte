<!--
  Two-level against multi-level logic: the same function as a minimal sum of products and as a factored network,
  drawn together (shared inputs, two outputs that always agree) and measured in gates, gate inputs, transistors
  and depth. Networks and metrics in multilevel.ts.

    ::two-vs-multi{n="12.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import LiveDag from '../../11-boolean-algebra/widgets/LiveDag.svelte';
  import { layoutDag } from '../../11-boolean-algebra/widgets/layout';
  import { EXAMPLES, both, metrics, prefixed, twoLevel } from './multilevel';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let id = $state('common');
  const ex = $derived(EXAMPLES.find((e) => e.id === id)!);
  const drawn = $derived(both(ex));
  const circuit = $derived(layoutDag(drawn.dag, { title: ex.label, order: drawn.order }));
  const flat = $derived(metrics(prefixed(twoLevel(ex), 's_', 'Y')));
  const multi = $derived(metrics(prefixed(ex.multi, 'm_', 'Y')));
  const rows = $derived([
    { k: 'Gates', a: flat.gates, b: multi.gates, why: 'AND, OR, NOT and XOR gates of any number of inputs' },
    { k: 'Gate inputs', a: flat.gateInputs, b: multi.gateInputs, why: 'the classic size measure' },
    { k: 'Transistors', a: flat.transistors, b: multi.transistors, why: 'static CMOS estimate: area and power' },
    { k: 'Depth', a: flat.depth, b: multi.depth, why: 'gates on the longest path: delay' },
  ]);
  const better = (a: number, b: number) => (a === b ? 'same' : b < a ? 'multi' : 'flat');
</script>

<Widget title="Two levels or many" {n} {caption} onreset={() => (id = 'common')}>
  {#snippet controls()}
    <Segmented size="sm" label="Function" bind:value={id} options={EXAMPLES.map((e) => ({ value: e.id, label: e.label }))} />
  {/snippet}

  <div class="tm ui">
    <div class="forms">
      <div><span class="k">Two levels</span><code>{ex.flat}</code></div>
      <div><span class="k">Factored</span><code>{ex.factored}</code></div>
    </div>

    <LiveDag {circuit} scale={1.05} label="Two circuits for the same function: {ex.flat} and {ex.factored}" />

    <table class="cmp" aria-label="Comparison of the two circuits">
      <thead>
        <tr><th></th><th>Two levels</th><th>Factored</th><th class="why"></th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.k)}
          {@const w = better(r.a, r.b)}
          <tr>
            <th>{r.k}</th>
            <td class:win={w === 'flat'}>
              <span class="bar" style:width="{(100 * r.a) / Math.max(r.a, r.b, 1)}%"></span><b>{r.a}</b>
            </td>
            <td class:win={w === 'multi'} class:lose={w === 'flat' && r.k === 'Depth'}>
              <span class="bar" style:width="{(100 * r.b) / Math.max(r.a, r.b, 1)}%"></span><b>{r.b}</b>
            </td>
            <td class="why">{r.why}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="note">{ex.note}</p>
  </div>
</Widget>

<style>
  .tm {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .forms {
    display: grid;
    gap: 0.3rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
  }
  .forms div {
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
    white-space: nowrap;
  }
  .k {
    flex: none;
    width: 5.5rem;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    font-weight: 600;
  }
  .cmp {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.84rem;
  }
  .cmp th,
  .cmp td {
    text-align: left;
    padding: 0.28rem 0.5rem;
    border-top: 1px solid var(--line);
  }
  .cmp thead th {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
    border-top: 0;
  }
  .cmp tbody th {
    font-weight: 600;
    white-space: nowrap;
  }
  .cmp td {
    position: relative;
    min-width: 7rem;
  }
  .cmp td .bar {
    position: absolute;
    left: 0;
    top: 15%;
    bottom: 15%;
    background: var(--copper-soft);
    border-radius: 3px;
    z-index: 0;
  }
  .cmp td b {
    position: relative;
    font-family: var(--font-mono);
  }
  .cmp td.win b {
    color: var(--ok);
  }
  .cmp td.lose b {
    color: var(--bad);
  }
  .why {
    color: var(--mute);
    font-size: 0.76rem;
  }
  @media (max-width: 40rem) {
    .why {
      display: none;
    }
  }
  .note {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
