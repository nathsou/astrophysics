<!--
  Euler's audacious step: sin x / x behaves like a polynomial with roots ±π, ±2π, ±3π, …, so
  sin x / x = (1 − x²/π²)(1 − x²/4π²)(1 − x²/9π²) ⋯ Compare partial products with the function.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let K = $state(3);
  const W = 620;
  const H = 260;
  const R = 13;
  const X = (x: number) => 20 + ((x + R) / (2 * R)) * (W - 40);
  const Y = (y: number) => H / 2 - y * (H / 2 - 20);
  const sinc = (x: number) => (x === 0 ? 1 : Math.sin(x) / x);
  const prod = (x: number, k: number) => {
    let p = 1;
    for (let j = 1; j <= k; j++) p *= 1 - (x * x) / (j * j * Math.PI * Math.PI);
    return p;
  };
  const path = (f: (x: number) => number) =>
    Array.from({ length: 601 }, (_, i) => -R + (2 * R * i) / 600)
      .map((x, i) => {
        const y = Math.max(-1.3, Math.min(1.3, f(x)));
        return `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`;
      })
      .join('');
  const sincPath = path(sinc);
  const prodPath = $derived(path((x) => prod(x, K)));
  const partial = $derived(Array.from({ length: K }, (_, j) => 1 / ((j + 1) * (j + 1))).reduce((s, v) => s + v, 0));
</script>

<Widget title="Euler’s infinite product" subtitle="Black: sin x / x. Red: the product of the first K factors (1 − x²/k²π²). Each factor supplies the roots ±kπ; as K grows the product hugs the curve." onreset={() => (K = 3)}>
  {#snippet controls()}
    <label class="ctl">factors K = <strong>{K}</strong> <input type="range" min="1" max="40" bind:value={K} /></label>
    <span class="read num">coefficient of −x² in the product: (1/π²)(1 + 1/4 + … + 1/{K}²) = {(partial / (Math.PI * Math.PI)).toFixed(5)} → 1/6 = 0.16667</span>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="sin x over x and a partial product">
    <line x1="20" x2={W - 20} y1={Y(0)} y2={Y(0)} class="axis" />
    {#each Array.from({ length: 8 }, (_, i) => i - 4).filter((k) => k !== 0) as k (k)}
      <text x={X(k * Math.PI)} y={Y(0) + 14} class="lab">{k === 1 ? 'π' : k === -1 ? '−π' : `${k}π`.replace('-', '−')}</text>
    {/each}
    <path d={sincPath} class="sinc" />
    <path d={prodPath} class="prod" />
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
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .sinc {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.5;
  }
  .prod {
    fill: none;
    stroke: var(--byrne-red);
    stroke-width: 1.8;
  }
  .lab {
    font-size: 10px;
    fill: var(--ink-3);
    text-anchor: middle;
    font-family: var(--font-body);
    font-style: italic;
  }
</style>
