<!--
  How much does a benchmark score wobble? Two models whose true accuracies differ by a few points are each scored
  on n random items, many times over. The histogram shows the measured difference; the learner's
  accuracyInterval() gives the interval around one measurement.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(k: number, n: number): [number, number] {
    const p = k / n;
    const se = Math.sqrt((p * (1 - p)) / n);
    return [p - 1.96 * se, p + 1.96 * se];
  }
  const interval = $derived(impl.get('eval.interval', reference));
  const mine = $derived(impl.isMine('eval.interval'));

  let logN = $state(Math.log10(500));
  let gap = $state(0.02);
  const base = 0.7;
  const n = $derived(Math.round(10 ** logN));
  const TRIALS = 2000;

  const sim = $derived.by(() => {
    const rng = mulberry32(25);
    // Binomial draws by the normal approximation (exact enough here, and fast for large n).
    const draw = (p: number) => {
      const z = Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
      return Math.max(0, Math.min(n, Math.round(n * p + z * Math.sqrt(n * p * (1 - p)))));
    };
    const diffs: number[] = [];
    let wrongWay = 0;
    for (let t = 0; t < TRIALS; t++) {
      const a = draw(base + gap), b = draw(base);
      diffs.push((a - b) / n);
      if (a <= b) wrongWay++;
    }
    return { diffs, wrongWay: wrongWay / TRIALS };
  });
  const one = $derived.by(() => {
    try {
      return interval(Math.round((base + gap) * n), n);
    } catch {
      return reference(Math.round((base + gap) * n), n);
    }
  });
  const BINS = 41;
  const range = 0.15;
  const hist = $derived.by(() => {
    const h = new Array<number>(BINS).fill(0);
    for (const d of sim.diffs) {
      const b = Math.round(((d + range) / (2 * range)) * (BINS - 1));
      if (b >= 0 && b < BINS) h[b]!++;
    }
    return h;
  });
  const hmax = $derived(Math.max(...hist));
</script>

<Widget
  title="Benchmark noise"
  subtitle="Model A is truly better than model B by the gap below (70% + gap, against 70%). Each is scored on n random items, 2,000 times. How often does the benchmark rank them the wrong way round?"
  onreset={() => {
    logN = Math.log10(500);
    gap = 0.02;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Items n" min={1} max={4} step={0.01} value={logN} oninput={(v) => (logN = v)} format={() => n.toLocaleString('en-GB')} /></div>
    <div class="sl"><Slider label="True gap" min={0} max={0.1} step={0.005} value={gap} oninput={(v) => (gap = v)} format={(v) => `${(v * 100).toFixed(1)} points`} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your accuracyInterval().</p>{/if}
  <div class="hist" role="img" aria-label="Histogram of measured differences">
    {#each hist as c, i (i)}
      {@const x = -range + (2 * range * i) / (BINS - 1)}
      <div class="bar" class:neg={x <= 0} style:height="{(c / hmax) * 100}%" title="{(x * 100).toFixed(1)} points: {c}"></div>
    {/each}
    <div class="zero" style:left="50%"></div>
    <div class="truth" style:left="{((gap + range) / (2 * range)) * 100}%"></div>
  </div>
  <div class="axis ui"><span>−15 points</span><span>0</span><span>+15 points</span></div>
  <p class="note ui">
    Measured difference A − B over {TRIALS.toLocaleString('en-GB')} repeats (the dashed line is the true gap). The benchmark ranks B at least as high as A <strong class="num">{(sim.wrongWay * 100).toFixed(0)}%</strong> of the time.
    A single score of {((base + gap) * 100).toFixed(0)}% on {n.toLocaleString('en-GB')} items has a 95% interval of <strong class="num">{(one[0] * 100).toFixed(1)}–{(one[1] * 100).toFixed(1)}%</strong>.
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 12rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .hist {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 140px;
    border-bottom: 1px solid var(--rule);
  }
  .bar {
    flex: 1;
    background: var(--series-1);
    opacity: 0.8;
    border-radius: 2px 2px 0 0;
  }
  .bar.neg {
    background: var(--critical);
  }
  .zero,
  .truth {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--ink-3);
  }
  .truth {
    border-left: 1.5px dashed var(--ink);
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
