<!--
  Two roads to e: compound interest (1 + 1/n)ⁿ and the series Σ 1/k!. The error of each, on a log
  scale: the series is astonishingly fast, and that speed is exactly what proves e irrational.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(12);
  const fact = (k: number) => Array.from({ length: k }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
  const series = $derived(Array.from({ length: n + 1 }, (_, k) => k).map((k) => Array.from({ length: k + 1 }, (_, j) => 1 / fact(j)).reduce((a, b) => a + b, 0)));
  const interest = $derived(Array.from({ length: n + 1 }, (_, k) => (1 + 1 / Math.max(1, k)) ** Math.max(1, k)));
  const W = 600;
  const H = 240;
  const lo = -16;
  const X = (k: number) => 40 + (k / n) * (W - 60);
  const Y = (err: number) => {
    const l = Math.max(lo, Math.log10(Math.max(err, 1e-17)));
    return 15 + (-l / -lo) * (H - 40);
  };
  const path = (vals: number[]) => vals.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(Math.abs(Math.E - v)).toFixed(1)}`).join('');
</script>

<Widget title="Two roads to e" subtitle="Error |e − approximation| on a logarithmic scale. Red: (1 + 1/n)ⁿ, compound interest. Blue: 1 + 1/1! + 1/2! + ⋯ + 1/n!. The series gains digits faster and faster; floating-point arithmetic runs out at about 16 digits." onreset={() => (n = 12)}>
  {#snippet controls()}
    <label class="ctl">terms n = <strong>{n}</strong> <input type="range" min="4" max="20" bind:value={n} /></label>
    <span class="read num">series: {series[n]!.toFixed(15)} &nbsp; interest: {interest[n]!.toFixed(15)} &nbsp; e = {Math.E.toFixed(15)}</span>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Errors of two approximations to e">
    {#each [0, -4, -8, -12, -16] as p (p)}
      <line x1="40" x2={W - 20} y1={15 + (-p / -lo) * (H - 40)} y2={15 + (-p / -lo) * (H - 40)} class="grid" />
      <text x="34" y={19 + (-p / -lo) * (H - 40)} class="lab">10<tspan dy="-5" font-size="8">{p}</tspan></text>
    {/each}
    <path d={path(interest)} class="int" />
    <path d={path(series)} class="ser" />
  </svg>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .read {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .grid {
    stroke: var(--grid);
  }
  .lab {
    font-size: 10px;
    fill: var(--ink-3);
    text-anchor: end;
    font-family: var(--font-ui);
  }
  .int {
    fill: none;
    stroke: var(--byrne-red);
    stroke-width: 2;
  }
  .ser {
    fill: none;
    stroke: var(--byrne-blue);
    stroke-width: 2;
  }
</style>
