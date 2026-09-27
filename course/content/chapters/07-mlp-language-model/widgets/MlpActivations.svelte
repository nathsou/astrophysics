<!--
  Diagnostics for the shared MLP: distributions of hidden pre-activations and activations, the
  fraction of saturated units, and each parameter's update-to-value ratio over time.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Histogram from '$lib/charts/Histogram.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import MlpTrainer from './MlpTrainer.svelte';
  import { mlp } from '../trainer.svelte';

  onMount(() => {
    void mlp.load();
  });
  const snap = $derived(mlp.snapshot);
  const actName = $derived(mlp.config.act === 'none' ? 'identity' : mlp.config.act);
</script>

<Widget
  title="Inside the hidden layer"
  subtitle="Live from the model above (it keeps training while you scroll). Healthy hidden units spread over the useful range of the non-linearity; saturated ones pass almost no gradient."
>
  {#if snap}
    <div class="two">
      <div>
        <div class="ttl">Pre-activations (W₁x + b₁{mlp.config.norm ? ', after LayerNorm' : ''})</div>
        <Histogram values={snap.preact} label="Histogram of hidden pre-activations" xLabel="value" />
      </div>
      <div>
        <div class="ttl">
          After {actName} — <span class:bad={snap.saturated > 0.1}>{(snap.saturated * 100).toFixed(1)}% {mlp.config.act === 'relu' ? 'dead (exactly 0)' : mlp.config.act === 'tanh' ? 'saturated (|a| > 0.97)' : ''}</span>
        </div>
        <Histogram values={snap.act} range={mlp.config.act === 'tanh' ? [-1, 1] : undefined} mark={mlp.config.act === 'tanh' ? 0.97 : undefined} color="var(--series-3)" label="Histogram of hidden activations" xLabel="value" />
      </div>
    </div>
    <div class="ttl">Update-to-parameter ratio, log₁₀(η · std(∇θ) / std(θ))</div>
    <Legend items={[{ label: 'Embeddings C', color: 'var(--series-1)' }, { label: 'Hidden weights W₁', color: 'var(--series-2)' }, { label: 'Output weights W₂', color: 'var(--series-3)' }]} />
    <Plot
      label="Update-to-parameter ratio over training"
      height={180}
      x={{ domain: [0, Math.max(1000, mlp.step)], label: 'SGD steps', nice: true, ticks: 5 }}
      y={{ domain: [-6, 0], label: 'log₁₀ ratio', ticks: 6 }}
    >
      {#snippet marks({ sx, sy })}
        <line x1="0" x2={sx(Math.max(1000, mlp.step))} y1={sy(-3)} y2={sy(-3)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {#each [{ k: 'C', c: 'var(--series-1)' }, { k: 'W1', c: 'var(--series-2)' }, { k: 'W2', c: 'var(--series-3)' }] as s (s.k)}
          {#if mlp.ratios.length > 1}
            <path class="line" stroke={s.c} d={'M' + mlp.ratios.map((r) => `${sx(r.step)},${sy(Math.max(-6, Math.min(0, r[s.k as 'C' | 'W1' | 'W2'])))}`).join('L')} />
          {/if}
        {/each}
      {/snippet}
    </Plot>
    <p class="note">A common rule of thumb: updates of about a thousandth of the parameter’s scale per step (the dashed line at −3). Far below, a layer is barely learning; far above, it is being thrashed.</p>
  {:else}
    <p class="muted">Start training the model to see its internals…</p>
    <MlpTrainer compact />
  {/if}
</Widget>

<style>
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.25rem;
    margin-bottom: 1rem;
  }
  @media (max-width: 700px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .ttl {
    font-size: 0.78rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  .bad {
    color: var(--critical);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
