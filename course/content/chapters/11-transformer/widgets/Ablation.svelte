<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { ablation, VARIANTS, type Variant } from '../ablation.svelte';

  const t = ablation.trainer;
  onMount(() => {
    void t.load();
    return () => t.pause();
  });
  const bits = (n: number) => n / Math.LN2;
  const keys = Object.keys(VARIANTS) as Variant[];
  const color = (v: Variant) => `var(--series-${keys.indexOf(v) + 1})`;
  let sample = $state('');
</script>

<Widget
  title="Build the Transformer one part at a time"
  subtitle="Width 128, 4 heads, context 128, 3,000 AdamW steps on your GPU. Pick a variant and train it; finished runs stay on the chart. The table lists the result of each variant measured on an Apple M4 Pro, so you need not run them all."
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (t.running ? t.pause() : t.start())} disabled={t.status !== 'ready' || t.step >= t.cfg.steps}>
      {t.running ? 'Pause' : t.step ? (t.step >= t.cfg.steps ? 'Done' : 'Resume') : 'Train'}
    </Button>
    <Segmented label="Variant" size="sm" options={keys.map((k) => ({ value: k, label: VARIANTS[k].label }))} value={ablation.variant} onchange={(v) => ablation.select(v)} />
  {/snippet}

  {#if t.status === 'unsupported'}
    <p class="muted">Needs WebGPU; the table below lists results measured on an M4 Pro.</p>
  {:else if t.status !== 'ready'}
    <p class="muted">Loading…</p>
  {:else}
    <div class="stats">
      <span>{VARIANTS[ablation.variant].label}: parameters <strong class="num">{t.numParameters.toLocaleString('en-GB')}</strong></span>
      <span>step <strong class="num">{t.step.toLocaleString('en-GB')}</strong> / {t.cfg.steps.toLocaleString('en-GB')}</span>
      <span><strong class="num">{Number.isFinite(t.msPerStep) ? t.msPerStep.toFixed(1) : '…'}</strong> ms/step</span>
    </div>
    <Legend items={[...keys.filter((k) => ablation.curve(k)).map((k) => ({ label: VARIANTS[k].label, color: color(k) })), { label: 'Kneser–Ney 2.22 · LSTM 2.24', color: 'var(--ink-3)', dashed: true }]} />
    <Plot label="Validation loss of each variant" height={230} x={{ domain: [0, t.cfg.steps], label: 'AdamW steps', ticks: 6 }} y={{ domain: [2, 4.5], label: 'validation bits / char', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#each [2.22, 2.24] as b (b)}<line x1="0" x2={sx(t.cfg.steps)} y1={sy(b)} y2={sy(b)} stroke="var(--ink-3)" stroke-dasharray="4 4" />{/each}
        {#each keys as k (k)}
          {@const c = ablation.curve(k)}
          {#if c && c.length > 1}
            <path class="line" stroke={color(k)} d={'M' + c.map((h) => `${sx(h.step)},${sy(Math.min(4.5, bits(h.val)))}`).join('L')} />
          {/if}
        {/each}
      {/snippet}
    </Plot>
  {/if}
  <table class="results num ui">
    <thead><tr><th>variant</th><th>measured (M4 Pro)</th><th>your run</th></tr></thead>
    <tbody>
      {#each keys as k (k)}
        {@const c = ablation.curve(k)}
        <tr class:cur={k === ablation.variant}>
          <td><span class="sw" style:background={color(k)}></span>{VARIANTS[k].label}</td>
          <td>{VARIANTS[k].reference.toFixed(2)} bits/char</td>
          <td>{c && c.length > 1 ? `${bits(c.at(-1)!.val).toFixed(3)} (step ${c.at(-1)!.step})` : '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if t.status === 'ready' && t.step > 0}
    <div class="sample">
      <Button size="sm" onclick={async () => (sample = await t.sample('ROMEO:\n', 240))}>Sample 240 characters</Button>
      {#if sample}<pre class="out">ROMEO:<br />{sample}</pre>{/if}
    </div>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.3rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.5rem;
  }
  .stats strong {
    color: var(--ink);
  }
  .results {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-top: 0.8rem;
  }
  .results th {
    text-align: left;
    color: var(--ink-2);
    font-weight: 600;
    font-size: 0.72rem;
  }
  .results td {
    border-top: 1px solid var(--rule);
    padding: 0.2rem 0.3rem;
  }
  .results tr.cur td {
    background: var(--surface-2);
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
  .sample {
    margin-top: 0.8rem;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    white-space: pre-wrap;
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
  }
</style>
