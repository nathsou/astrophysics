<!--
  Why float16 training needs loss scaling: the gradients of a partly trained CourseGPT, as a histogram
  of log₂|g|, against the values float16 can represent. Multiplying the loss by 2^s shifts every
  gradient s powers of two to the right, out of the underflow zone.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { DATA } from '../data';

  const P = DATA.precision;
  let s = $state(0);
  // float16 in powers of two: below 2⁻²⁵ rounds to 0, [2⁻²⁴, 2⁻¹⁴) is subnormal, 65,504 ≈ 2¹⁶ overflows.
  const ZERO = -25, SUB = -14, MAX = 16;
  const total = P ? P.hist.reduce((a, b) => a + b, 0) : 1;
  const frac = $derived.by(() => {
    if (!P) return { zero: 0, sub: 0, over: 0 };
    let zero = 0, sub = 0, over = 0;
    P.hist.forEach((n, k) => {
      const lg = P.log2_min + k + s; // this bin, after scaling, covers [lg, lg + 1)
      if (lg < ZERO) zero += n;
      else if (lg < SUB) sub += n;
      else if (lg >= MAX) over += n;
    });
    return { zero: zero / total, sub: sub / total, over: over / total };
  });
  const maxBin = P ? Math.max(...P.hist) / total : 1;
  const pct = (f: number) => (f === 0 ? '0%' : f < 0.001 ? '< 0.1%' : `${(f * 100).toFixed(1)}%`);
  const X0 = -50, X1 = 22;
</script>

<Widget
  title="Loss scaling rescues float16 gradients"
  subtitle="Every gradient entry of CourseGPT (part-way through training) on a log scale, against float16’s range. Scale the loss by 2^s and every gradient moves s powers of two to the right."
  onreset={() => (s = 0)}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Loss scale 2^s" min={0} max={24} step={1} value={s} oninput={(v) => (s = Math.round(v))} format={(v) => `2^${Math.round(v)} = ${(2 ** Math.round(v)).toLocaleString('en-GB')}`} /></div>
  {/snippet}

  {#if !P}
    <p class="muted">Run <code>uv run lmc ch14 precision</code> and <code>uv run lmc ch14 summary</code> to measure the gradients.</p>
  {:else}
    <div class="stats ui">
      <span class:bad={frac.zero > 0.001}><strong class="num">{pct(frac.zero)}</strong> round to zero</span>
      <span class:warn={frac.sub > 0.01}><strong class="num">{pct(frac.sub)}</strong> subnormal (precision lost)</span>
      <span class:bad={frac.over > 0}><strong class="num">{pct(frac.over)}</strong> overflow to ∞</span>
    </div>
    <Plot label="Histogram of gradient magnitudes against float16's range" height={240} x={{ domain: [X0, X1], label: 'log₂ |gradient × scale|', tickValues: [-48, -40, -32, -25, -14, 0, 16] }} y={{ domain: [0, maxBin * 1.1], label: 'share of entries', format: (v) => `${(v * 100).toFixed(0)}%`, ticks: 4 }}>
      {#snippet marks({ sx, sy })}
        <rect x={sx(X0)} y={0} width={sx(ZERO) - sx(X0)} height={sy(0)} fill="var(--critical)" opacity="0.12" />
        <rect x={sx(ZERO)} y={0} width={sx(SUB) - sx(ZERO)} height={sy(0)} fill="var(--warn)" opacity="0.14" />
        <rect x={sx(MAX)} y={0} width={sx(X1) - sx(MAX)} height={sy(0)} fill="var(--critical)" opacity="0.12" />
        {#each P.hist as n, k (k)}
          {@const lg = P.log2_min + k + s}
          {#if lg >= X0 && lg < X1 && n > 0}
            <rect x={sx(lg) + 0.5} y={sy(n / total)} width={Math.max(1, sx(lg + 1) - sx(lg) - 1)} height={sy(0) - sy(n / total)} fill="var(--series-1)" />
          {/if}
        {/each}
        <text x={sx((X0 + ZERO) / 2)} y={14} text-anchor="middle" class="zone">→ 0</text>
        <text x={sx((ZERO + SUB) / 2)} y={14} text-anchor="middle" class="zone">subnormal</text>
        <text x={sx((MAX + X1) / 2)} y={14} text-anchor="middle" class="zone">→ ∞</text>
      {/snippet}
    </Plot>
    <p class="note ui">
      The median gradient entry is about 2^{P.median_log2.toFixed(0)}. Without scaling, {pct(P.scales['0']!.zero)} of the entries would round to zero in float16 and {pct(P.scales['0']!.subnormal)} would be subnormal, keeping only a few bits of precision. A scale of 2^12 = 4,096 leaves {pct(P.scales['12']!.zero)} at zero and {pct(P.scales['12']!.subnormal)} subnormal, and nothing overflows even at 2^20 — dynamic loss scaling (the exercise below) finds such a scale automatically. bfloat16’s range reaches 2⁻¹³³, so it needs no scaling at all.
    </p>
  {/if}
</Widget>

<style>
  .sl {
    flex: 1 1 18rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.85rem;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0 0 0.5rem;
  }
  .stats strong {
    color: var(--ink);
    font-size: 1rem;
  }
  .stats .bad strong {
    color: var(--critical);
  }
  .stats .warn strong {
    color: var(--warn);
  }
  .zone {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
