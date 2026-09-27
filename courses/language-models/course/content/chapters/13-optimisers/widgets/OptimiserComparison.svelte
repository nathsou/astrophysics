<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { comparison, OPTIMISERS, type OptName } from '../comparison.svelte';

  const t = comparison.trainer;
  onMount(() => {
    void t.load();
    return () => t.pause();
  });
  const keys = Object.keys(OPTIMISERS) as OptName[];
  const color = (k: OptName) => `var(--series-${keys.indexOf(k) + 1})`;
  const bits = (n: number) => n / Math.LN2;
</script>

<Widget
  title="Optimisers on a real model"
  subtitle="Chapter 11’s two-layer Transformer, 1,500 steps, each optimiser at a learning rate tuned for it (same schedule, same data order). Pick one and train it; finished runs stay on the chart."
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (t.running ? t.pause() : t.start())} disabled={t.status !== 'ready' || t.step >= t.cfg.steps}>
      {t.running ? 'Pause' : t.step ? (t.step >= t.cfg.steps ? 'Done' : 'Resume') : 'Train'}
    </Button>
    <Segmented label="Optimiser" size="sm" options={keys.map((k) => ({ value: k, label: OPTIMISERS[k].label }))} value={comparison.choice} onchange={(v) => comparison.select(v)} />
  {/snippet}

  {#if t.status === 'unsupported'}
    <p class="muted">Needs WebGPU; the table below lists results measured on an Apple M4 Pro.</p>
  {:else if t.status !== 'ready'}
    <p class="muted">Loading…</p>
  {:else}
    <p class="stats ui num">{OPTIMISERS[comparison.choice].label}: step {t.step.toLocaleString('en-GB')} / {t.cfg.steps.toLocaleString('en-GB')} · {Number.isFinite(t.msPerStep) ? t.msPerStep.toFixed(1) : '…'} ms/step</p>
    <Legend items={keys.filter((k) => comparison.curve(k)).map((k) => ({ label: OPTIMISERS[k].label, color: color(k) }))} />
    <Plot label="Validation loss by optimiser" height={230} x={{ domain: [0, t.cfg.steps], label: 'step', ticks: 6 }} y={{ domain: [2, 4.5], label: 'validation bits / char', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#each keys as k (k)}
          {@const c = comparison.curve(k)}
          {#if c && c.length > 1}<path class="line" stroke={color(k)} d={'M' + c.map((h) => `${sx(h.step)},${sy(Math.min(4.5, bits(h.val)))}`).join('L')} />{/if}
        {/each}
      {/snippet}
    </Plot>
  {/if}
  <table class="results num ui">
    <thead><tr><th>optimiser</th><th>learning rate</th><th>measured (M4 Pro)</th><th>your run</th></tr></thead>
    <tbody>
      {#each keys as k (k)}
        {@const c = comparison.curve(k)}
        <tr class:cur={k === comparison.choice}>
          <td><span class="sw" style:background={color(k)}></span>{OPTIMISERS[k].label}</td>
          <td>{OPTIMISERS[k].cfg.optimiser === 'muon' ? `${OPTIMISERS[k].cfg.muonLr} (matrices), ${OPTIMISERS[k].cfg.lr} (rest)` : OPTIMISERS[k].cfg.lr}</td>
          <td>{Number.isFinite(OPTIMISERS[k].reference) ? `${OPTIMISERS[k].reference.toFixed(2)} bits/char` : '—'}</td>
          <td>{c && c.length > 1 ? `${bits(c.at(-1)!.val).toFixed(3)} (step ${c.at(-1)!.step})` : '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</Widget>

<style>
  .muted {
    color: var(--ink-3);
  }
  .stats {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0 0 0.4rem;
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
</style>
