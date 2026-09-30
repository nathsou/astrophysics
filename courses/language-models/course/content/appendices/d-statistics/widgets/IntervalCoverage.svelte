<!--
  What "95% confidence" means: repeat an experiment many times, build an interval each time, and count how often
  the interval contains the truth. The normal (Wald) interval falls short for small n or accuracies near 0 or 1;
  the Wilson interval stays close to 95%.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let p = $state(0.9);
  let logN = $state(Math.log10(30));
  let seed = $state(1);
  const n = $derived(Math.round(10 ** logN));
  const z = 1.96;
  const wald = (k: number, n: number): [number, number] => {
    const q = k / n, se = Math.sqrt((q * (1 - q)) / n);
    return [q - z * se, q + z * se];
  };
  const wilson = (k: number, n: number): [number, number] => {
    const q = k / n, d = 1 + (z * z) / n, c = (q + (z * z) / (2 * n)) / d;
    const h = (z * Math.sqrt((q * (1 - q)) / n + (z * z) / (4 * n * n))) / d;
    return [c - h, c + h];
  };
  const runs = $derived.by(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: 1000 }, () => {
      let k = 0;
      for (let i = 0; i < n; i++) k += Number(rng() < p);
      return { k, w: wald(k, n), s: wilson(k, n) };
    });
  });
  const cover = (key: 'w' | 's') => runs.filter((r) => r[key][0] <= p && p <= r[key][1]).length / runs.length;
  const shown = $derived(runs.slice(0, 40));
  // The horizontal axis shows accuracies from 0.4 to 1.
  const X = (v: number) => ((Math.min(1, Math.max(0.4, v)) - 0.4) / 0.6) * 400;
</script>

<Widget
  title="What 95% confidence means"
  subtitle="Each row is one experiment: n items, each right with true probability p (the vertical line). Each builds a 95% interval from its own result. Over 1,000 repetitions, how often does the interval contain the truth?"
  onreset={() => {
    p = 0.9;
    logN = Math.log10(30);
    seed = 1;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="True accuracy p" min={0.5} max={0.99} step={0.01} value={p} oninput={(v) => (p = v)} /></div>
    <div class="sl"><Slider label="Items n" min={1} max={3} step={0.01} value={logN} oninput={(v) => (logN = v)} format={() => `${n}`} /></div>
    <Button size="sm" onclick={() => seed++}>New experiments</Button>
  {/snippet}

  <svg viewBox="0 0 400 {shown.length * 6 + 6}" class="rows" role="img" aria-label="Forty intervals">
    {#each [0.4, 0.6, 0.8, 1] as t (t)}<text x={X(t)} y={shown.length * 6 + 3} class="tick" text-anchor={t === 1 ? 'end' : 'start'}>{t}</text>{/each}
    <line x1={X(p)} x2={X(p)} y1="0" y2={shown.length * 6 + 4} stroke="var(--ink)" stroke-width="1" />
    {#each shown as r, i (i)}
      {@const miss = r.w[0] > p || r.w[1] < p}
      <line x1={X(r.w[0])} x2={X(r.w[1])} y1={i * 6 + 3} y2={i * 6 + 3} stroke={miss ? 'var(--critical)' : 'var(--series-1)'} stroke-width="2.5" />
      <circle cx={X(r.k / n)} cy={i * 6 + 3} r="1.6" fill="var(--ink)" />
    {/each}
  </svg>
  <p class="note ui">
    Normal-approximation (Wald) interval, p̂ ± 1.96 √(p̂(1 − p̂)/n): contains p in <strong class="num">{(cover('w') * 100).toFixed(1)}%</strong> of experiments (red rows above miss).
    Wilson interval: <strong class="num">{(cover('s') * 100).toFixed(1)}%</strong>. Both aim for 95%.
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .rows {
    width: 100%;
    max-height: 260px;
    background: var(--surface-2);
    border-radius: 4px;
  }
  .tick {
    font-size: 5px;
    fill: var(--ink-3);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
