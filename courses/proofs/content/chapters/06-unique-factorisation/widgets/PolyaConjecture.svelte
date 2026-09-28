<!--
  Pólya's conjecture (1919): for every n ≥ 2, at least half of the numbers 1..n have an odd number
  of prime factors (counted with multiplicity). Equivalently L(n) = Σ λ(k) ≤ 0, where
  λ(k) = (−1)^(number of prime factors of k). It holds up to 906,150,256 — and then fails.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';

  let N = $state(20000);
  let L = $state<Int32Array | null>(null);
  const MAX = 400000;

  onMount(() => {
    // Ω(k) by a smallest-prime-factor sieve, then running sums of λ(k) = (−1)^Ω(k).
    const spf = new Int32Array(MAX + 1);
    for (let i = 2; i <= MAX; i++) {
      if (spf[i]) continue;
      for (let j = i; j <= MAX; j += i) if (!spf[j]) spf[j] = i;
    }
    const omega = new Uint8Array(MAX + 1);
    for (let k = 2; k <= MAX; k++) omega[k] = omega[k / spf[k]!]! + 1;
    const sums = new Int32Array(MAX + 1);
    for (let k = 1; k <= MAX; k++) sums[k] = sums[k - 1]! + (omega[k]! % 2 === 0 ? 1 : -1);
    L = sums;
  });

  const W = 620;
  const H = 220;
  const series = $derived.by(() => {
    if (!L) return { d: '', min: 0, max: 1, maxAfter1: 0 };
    const step = Math.max(1, Math.floor(N / 600));
    let min = 0;
    let max = 1;
    let maxAfter1 = -Infinity;
    for (let k = 1; k <= N; k++) {
      min = Math.min(min, L[k]!);
      max = Math.max(max, L[k]!);
      if (k >= 2) maxAfter1 = Math.max(maxAfter1, L[k]!);
    }
    const y = (v: number) => H - 20 - ((v - min) / (max - min)) * (H - 40);
    let d = '';
    for (let k = 1; k <= N; k += step) d += `${d ? 'L' : 'M'}${((k / N) * (W - 50) + 40).toFixed(1)},${y(L[k]!).toFixed(1)}`;
    return { d, min, max, maxAfter1, zero: y(0) };
  });
</script>

<Widget title="A conjecture that held for 906 million numbers" subtitle="L(n) counts numbers up to n with an even number of prime factors, minus those with an odd number (e.g. 12 = 2·2·3 has three). Pólya conjectured L(n) ≤ 0 for all n ≥ 2." onreset={() => (N = 20000)}>
  {#snippet controls()}
    <label class="ctl">n up to <strong class="num">{N.toLocaleString('en-GB')}</strong>
      <input type="range" min="100" max={MAX} step="100" bind:value={N} aria-label="Range of n" />
    </label>
  {/snippet}
  {#if L}
    <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Graph of L(n) for n up to {N}, staying at or below zero">
      <line x1="40" x2={W - 10} y1={series.zero} y2={series.zero} class="zero" />
      <text x="34" y={series.zero} class="lab">0</text>
      <path d={series.d} class="line" />
      <text x="34" y="24" class="lab">{series.max}</text>
      <text x="34" y={H - 16} class="lab">{series.min}</text>
    </svg>
    <p class="read num">Largest value of L(n) for 2 ≤ n ≤ {N.toLocaleString('en-GB')}: <strong>{series.maxAfter1}</strong> — never positive. The first n with L(n) &gt; 0 is 906,150,257.</p>
  {:else}
    <p class="read">Sieving…</p>
  {/if}
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .ctl input {
    width: 16rem;
  }
  .zero {
    stroke: var(--bad);
    stroke-dasharray: 5 4;
  }
  .line {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 1.2;
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-3);
    text-anchor: end;
    dominant-baseline: central;
    font-family: var(--font-ui);
  }
  .read {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
    color: var(--ink-2);
    text-align: center;
  }
</style>
