<!--
  The short runs that chose CourseGPT's settings: its shape at 1/20 of its token budget, with AdamW
  at four learning rates and Muon (for the matrices) at three.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { DATA } from '../data';

  const runs = DATA.sweep;
  const best = runs.length ? runs.reduce((a, b) => (b.val_bits < a.val_bits ? b : a)) : null;
  let hover = $state<string | null>(null);
  const color = (i: number) => `var(--series-${(i % 8) + 1})`;
  const label = (run: string) => {
    const [opt, lr] = run.split('-');
    return opt === 'muon' ? `Muon ${lr} (AdamW 4e-3 for the rest)` : `AdamW ${lr}`;
  };
  const maxStep = Math.max(1, ...runs.flatMap((r) => r.curve.map((c) => c[0])));
</script>

<Widget
  title="Choosing the learning rate"
  subtitle="CourseGPT’s shape trained for 800 steps (52 M tokens, 1/20 of the full run) per setting. Hover a row to pick out its curve."
  kind="Measured"
>
  {#if !runs.length}
    <p class="muted">Run <code>uv run lmc ch14 sweep</code> and <code>uv run lmc ch14 summary</code>.</p>
  {:else}
    <div class="two">
      <Plot label="Training loss curves of the sweep" height={240} x={{ domain: [100, maxStep], label: 'step', ticks: 5 }} y={{ domain: [1.9, 4.5], label: 'training bits / token', ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          {#each runs as r, i (r.run)}
            <path class="line" stroke={color(i)} stroke-width={hover === r.run ? 3 : 1.5} opacity={hover && hover !== r.run ? 0.25 : 1} d={'M' + r.curve.map(([s, b]) => `${sx(s)},${sy(Math.min(4.5, b))}`).join('L')} />
          {/each}
        {/snippet}
      </Plot>
      <table class="results num ui">
        <thead><tr><th>setting</th><th>validation bits / token</th></tr></thead>
        <tbody>
          {#each runs as r, i (r.run)}
            <tr class:best={r === best} onpointerenter={() => (hover = r.run)} onpointerleave={() => (hover = null)}>
              <td><span class="sw" style:background={color(i)}></span>{label(r.run)}</td>
              <td>{r.val_bits.toFixed(3)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.85rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 1.2rem;
    align-items: start;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .results {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .results th {
    text-align: left;
    color: var(--ink-2);
    font-weight: 600;
    font-size: 0.72rem;
  }
  .results td {
    border-top: 1px solid var(--rule);
    padding: 0.25rem 0.3rem;
  }
  .results tr.best td {
    font-weight: 700;
  }
  .results tr:hover td {
    background: var(--surface-2);
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
</style>
