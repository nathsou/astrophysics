<!--
  Our sweep: final validation loss against model size for runs sharing a compute budget, with the
  parabola in log N fitted to each budget and its minimum, the compute-optimal size.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DATA, si } from '../data';

  type Run = (typeof DATA.runs)[number] | NonNullable<typeof DATA.first_sweep>['runs'][number];
  let which = $state<'final' | 'first'>('final');
  const runs = $derived<Run[]>(which === 'final' ? DATA.runs : (DATA.first_sweep?.runs ?? []));
  const fit = $derived(which === 'final' ? DATA.fit : DATA.first_sweep?.fit);
  const all = [...DATA.runs, ...(DATA.first_sweep?.runs ?? [])];
  const budgets = [...new Set(DATA.runs.map((r) => r.budget))].sort((a, b) => a - b);
  const colour = (c: number) => `var(--series-${budgets.indexOf(c) + 1})`;
  let hover = $state<Run | null>(null);
  // Shared axes for both sweeps, so switching shows the shift.
  const nMin = Math.min(...all.map((r) => r.total)) / 1.3;
  const nMax = Math.max(...all.map((r) => r.total)) * 1.3;
  const yMin = Math.min(...all.map((r) => r.val_bits)) - 0.05;
  const yMax = Math.max(...all.map((r) => r.val_bits)) + 0.05;
  // The nearest run to the pointer, in the plot's own (log N, loss) coordinates; none if far away.
  function pick(p: { x: number; y: number } | null) {
    if (!p) return void (hover = null);
    let best: Run | null = null, dist = Infinity;
    for (const r of runs) {
      const d = (Math.log(r.total / p.x) / Math.log(nMax / nMin)) ** 2 + ((r.val_bits - p.y) / (yMax - yMin)) ** 2;
      if (d < dist) (best = r), (dist = d);
    }
    hover = dist < 0.004 ? best : null;
  }
  const parabola = (p: [number, number, number], n: number) => p[0] * Math.log(n) ** 2 + p[1] * Math.log(n) + p[2];
</script>

<Widget
  title="Our IsoFLOP curves"
  subtitle="Seventeen GPTs trained on TinyStories, each spending one of three compute budgets. At a fixed budget, a bigger model sees fewer tokens. Each curve is a parabola in ln N fitted to its budget’s runs; its lowest point is the compute-optimal size."
  kind="Measured"
>
  {#snippet controls()}
    {#if DATA.first_sweep}<Segmented label="Sweep" size="sm" options={[{ value: 'final', label: '32,768 tokens per step' }, { value: 'first', label: 'First sweep: 8,192 tokens per step' }]} bind:value={which} />{/if}
  {/snippet}
  {#if !runs.length}
    <p class="muted">Run <code>uv run lmc ch17 sweep</code>, <code>fit</code> and <code>summary</code>.</p>
  {:else}
    <Legend items={budgets.map((c) => ({ label: `C = ${c.toPrecision(3)} FLOPs`, color: colour(c) }))} />
    <Plot label="Final validation loss against model size, by compute budget" height={280} onpointer={pick} x={{ type: 'log', domain: [nMin, nMax], label: 'parameters N (including embeddings)', tickValues: [1e6, 3e6, 1e7, 3e7], format: (v) => si(v) }} y={{ domain: [yMin, yMax], label: 'validation bits / token', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#if fit}
          {#each fit.minima as m (m.budget)}
            {@const lo = Math.min(...runs.filter((r) => r.budget === m.budget).map((r) => r.total))}
            {@const hi = Math.max(...runs.filter((r) => r.budget === m.budget).map((r) => r.total))}
            <path class="line" stroke={colour(m.budget)} opacity="0.6" d={'M' + Array.from({ length: 50 }, (_, i) => lo * (hi / lo) ** (i / 49)).map((n) => `${sx(n)},${sy(Math.min(yMax, parabola(m.parabola, n)))}`).join('L')} />
            <path d="M{sx(m.n_opt) - 6},{sy(m.loss) + 6}L{sx(m.n_opt)},{sy(m.loss) - 4}L{sx(m.n_opt) + 6},{sy(m.loss) + 6}Z" fill="none" stroke={colour(m.budget)} stroke-width="2" />
          {/each}
        {/if}
        {#each runs as r (`${r.budget}-${r.layers}x${r.width}`)}
          <circle cx={sx(r.total)} cy={sy(r.val_bits)} r={hover === r ? 7 : 5} fill={colour(r.budget)} />
        {/each}
      {/snippet}
    </Plot>
    <p class="note ui">
      {#if hover}
        <strong>{hover.layers} layers × {hover.width}</strong>: {si(hover.total)} parameters, trained on {si(hover.tokens)} tokens ({(hover.tokens / hover.total).toFixed(1)} per parameter){#if 'seconds' in hover} in {(hover.seconds / 60).toFixed(1)} minutes{/if}: {hover.val_bits.toFixed(3)} bits / token.
      {:else if fit}
        Triangles mark each parabola’s minimum. The optimal sizes for the three budgets are {fit.minima.map((m) => si(m.n_opt)).join(', ')} parameters, trained on {fit.minima.map((m) => (m.d_opt / m.n_opt).toFixed(1)).join(', ')} tokens per parameter{#if fit.n_opt_exponent}; N_opt grows as C^{fit.n_opt_exponent.toFixed(2)}{/if}. Hover a point for its run.
      {/if}
    </p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
    min-height: 2.5em;
  }
</style>
