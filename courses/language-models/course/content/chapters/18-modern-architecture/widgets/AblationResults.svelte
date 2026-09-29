<!--
  Measured: the 6 × 384 GPT trained with the same data, compute and optimiser, changing one piece of the
  block at a time (and all four at once). Two baseline seeds show the size of run-to-run noise.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const runs = DATA.runs;
  const base = runs.find((r) => r.key === 'gpt2');
  const seed2 = runs.find((r) => r.key === 'gpt2-seed2');
  const noise = base && seed2 ? Math.abs(base.val_bits - seed2.val_bits) : 0;
  let view = $state<'final' | 'curves'>('final');
  const lo = Math.min(...runs.map((r) => r.val_bits)) - 0.03;
  const hi = Math.max(...runs.map((r) => r.val_bits)) + 0.02;
  const colour = (i: number) => `var(--series-${(i % 8) + 1})`;
</script>

<Widget
  title="Llama’s changes, one at a time"
  subtitle={`The same 6-layer, width-384 model on TinyStories, trained with ${(DATA.budget ?? 6.25e15).toExponential(2).replace('e+15', ' × 10¹⁵')} FLOPs each (${DATA.steps?.toLocaleString('en-GB') ?? '…'} steps), the same data and optimiser; only the block changes. The second baseline differs only in its random seed.`}
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="View" size="sm" options={[{ value: 'final', label: 'Final loss' }, { value: 'curves', label: 'Training curves' }]} bind:value={view} />
  {/snippet}
  {#if !runs.length}
    <p class="muted">Run <code>uv run lmc ch18 ablation</code> and <code>uv run lmc ch18 summary</code>.</p>
  {:else if view === 'final'}
    <div class="bars">
      <span class="h ui"></span><span class="h ui">validation bits / token (shorter is better)</span><span class="h ui">vs baseline</span><span class="h ui">tokens / s</span>
      {#each runs as r, i (r.key)}
        <div class="lbl">{r.label}</div>
        <div class="track"><div class="bar" style:width="{((r.val_bits - lo) / (hi - lo)) * 100}%" style:background={colour(i)}></div><span class="num">{r.val_bits.toFixed(3)}</span></div>
        <div class="num d" class:good={base && r.val_bits < base.val_bits - noise}>{base && r !== base ? `${r.val_bits - base.val_bits >= 0 ? '+' : ''}${(r.val_bits - base.val_bits).toFixed(3)}` : ''}</div>
        <div class="num t">{r.tokens_per_s ? `${Math.round(r.tokens_per_s / 1000)}k` : ''}</div>
      {/each}
    </div>
    <p class="note ui">The two baseline seeds differ by {noise.toFixed(3)} bits per token: differences smaller than that are noise. The bars start at {lo.toFixed(2)} to make differences visible.</p>
  {:else}
    <Legend items={runs.map((r, i) => ({ label: r.label, color: colour(i) }))} />
    <Plot label="Training loss curves" height={260} x={{ domain: [300, DATA.steps ?? 2000], label: 'step', ticks: 6 }} y={{ domain: [lo - 0.1, 3.4], label: 'training bits / token', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#each runs as r, i (r.key)}
          <path class="line" stroke={colour(i)} stroke-width="1.5" d={'M' + r.curve.filter(([s]) => s >= 300).map(([s, b]) => `${sx(s)},${sy(Math.min(3.4, b))}`).join('L')} />
        {/each}
      {/snippet}
    </Plot>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(9rem, max-content) minmax(0, 1fr) 4.5rem 4rem;
    gap: 0.3rem 0.7rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .h {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .lbl {
    color: var(--ink-2);
  }
  .track {
    position: relative;
    height: 1.1rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .track span {
    position: absolute;
    right: 0.3rem;
    top: 0;
    line-height: 1.1rem;
    font-size: 0.72rem;
  }
  .bar {
    height: 100%;
    border-radius: 3px;
    opacity: 0.85;
  }
  .d {
    text-align: right;
    color: var(--ink-2);
  }
  .d.good {
    color: var(--good);
    font-weight: 600;
  }
  .t {
    text-align: right;
    color: var(--ink-3);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
