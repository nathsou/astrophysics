<!--
  Learning-rate schedules: constant, step decay, warm-up + cosine (GPT-2, and this course), and
  warm-up–stable–decay (many recent models). The area under each curve is the total "distance" the
  optimiser is allowed to travel.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';

  const STEPS = 5000;
  let warmup = $state(200);
  let minRatio = $state(0.1);
  let decayFrac = $state(0.2);
  let show = $state({ constant: true, step: false, cosine: true, wsd: true });

  const SCHEDULES = {
    constant: { label: 'Constant (after warm-up)', color: 'var(--series-4)', f: (s: number) => (s < warmup ? (s + 1) / warmup : 1) },
    step: { label: 'Step decay (×0.1 at 60% and 85%)', color: 'var(--series-3)', f: (s: number) => (s < warmup ? (s + 1) / warmup : s < 0.6 * STEPS ? 1 : s < 0.85 * STEPS ? 0.1 : 0.01) },
    cosine: {
      label: 'Warm-up + cosine',
      color: 'var(--series-1)',
      f: (s: number) => {
        if (s < warmup) return (s + 1) / warmup;
        const p = (s - warmup) / (STEPS - warmup);
        return minRatio + (1 - minRatio) * 0.5 * (1 + Math.cos(Math.PI * p));
      },
    },
    wsd: {
      label: 'Warm-up–stable–decay',
      color: 'var(--series-2)',
      f: (s: number) => {
        if (s < warmup) return (s + 1) / warmup;
        const start = STEPS * (1 - decayFrac);
        if (s < start) return 1;
        return 1 - (1 - minRatio) * ((s - start) / (STEPS - start));
      },
    },
  } as const;
  type Key = keyof typeof SCHEDULES;
  const keys = Object.keys(SCHEDULES) as Key[];
  const xs = Array.from({ length: 251 }, (_, i) => (i * STEPS) / 250);
  const area = (k: Key) => xs.reduce((a, s) => a + SCHEDULES[k].f(s), 0) / xs.length;
</script>

<Widget
  title="Learning-rate schedules"
  subtitle="Learning rate (as a fraction of its peak) over a 5,000-step run. Every schedule starts with a warm-up; they differ in how — and when — they come down."
  onreset={() => {
    warmup = 200;
    minRatio = 0.1;
    decayFrac = 0.2;
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="warm-up steps" min={0} max={1500} step={10} value={warmup} oninput={(v) => (warmup = Math.max(1, Math.round(v)))} format={(v) => String(Math.round(v))} /></div>
    <div class="ctl"><Slider label="final fraction of peak" min={0} max={1} step={0.01} value={minRatio} oninput={(v) => (minRatio = v)} format={(v) => v.toFixed(2)} /></div>
    <div class="ctl"><Slider label="WSD decay phase" min={0.05} max={0.6} step={0.01} value={decayFrac} oninput={(v) => (decayFrac = v)} format={(v) => `${(v * 100).toFixed(0)}% of the run`} /></div>
  {/snippet}

  <div class="toggles ui">
    {#each keys as k (k)}<Toggle bind:checked={show[k]} label={SCHEDULES[k].label} />{/each}
  </div>
  <Legend items={keys.filter((k) => show[k]).map((k) => ({ label: `${SCHEDULES[k].label} — mean ${area(k).toFixed(2)}`, color: SCHEDULES[k].color }))} />
  <Plot label="Learning-rate schedules" height={240} x={{ domain: [0, STEPS], label: 'step', ticks: 5 }} y={{ domain: [0, 1.05], label: 'learning rate / peak', ticks: 5 }}>
    {#snippet marks({ sx, sy })}
      {#each keys as k (k)}
        {#if show[k]}<path class="line" stroke={SCHEDULES[k].color} d={'M' + xs.map((s) => `${sx(s)},${sy(SCHEDULES[k].f(s))}`).join('L')} />{/if}
      {/each}
    {/snippet}
    {#snippet tooltip({ x })}
      <div class="num">step {Math.round(x)}: {keys.filter((k) => show[k]).map((k) => `${SCHEDULES[k].label.split(' ')[0]} ${SCHEDULES[k].f(x).toFixed(3)}`).join(' · ')}</div>
    {/snippet}
  </Plot>
  <p class="note ui">
    The mean of each curve is how much total learning rate the run spends. Warm-up–stable–decay keeps the rate high for most of the run and anneals quickly at the end. You can therefore branch several decays from one long stable phase, to get models at different budgets from a single run.
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 13rem;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.2rem;
    margin-bottom: 0.5rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
