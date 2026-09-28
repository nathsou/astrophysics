<!--
  Lower and upper sums for a continuous function: the area is trapped between them, and the gap
  shrinks to zero as the partition is refined.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  interface Fn {
    name: string;
    tex: string;
    f: (x: number) => number;
    a: number;
    b: number;
    exact: number;
    exactTex: string;
  }
  const FNS: Fn[] = [
    { name: 'x² on [0, 1]', tex: 'x^2', f: (x) => x * x, a: 0, b: 1, exact: 1 / 3, exactTex: '\\tfrac13' },
    { name: 'sin x on [0, π]', tex: '\\sin x', f: Math.sin, a: 0, b: Math.PI, exact: 2, exactTex: '2' },
    { name: '1/x on [1, e]', tex: '\\tfrac1x', f: (x) => 1 / x, a: 1, b: Math.E, exact: 1, exactTex: '1' },
    { name: '√(1 − x²) on [0, 1]', tex: '\\sqrt{1 - x^2}', f: (x) => Math.sqrt(Math.max(0, 1 - x * x)), a: 0, b: 1, exact: Math.PI / 4, exactTex: '\\tfrac{\\pi}{4}' },
  ];
  let which = $state(0);
  let n = $state(6);
  const F = $derived(FNS[which]!);

  const rects = $derived.by(() => {
    const out: { x: number; w: number; lo: number; hi: number }[] = [];
    const w = (F.b - F.a) / n;
    for (let i = 0; i < n; i++) {
      const x = F.a + i * w;
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k <= 40; k++) {
        const v = F.f(x + (w * k) / 40);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      out.push({ x, w, lo, hi });
    }
    return out;
  });
  const lower = $derived(rects.reduce((s, r) => s + r.lo * r.w, 0));
  const upper = $derived(rects.reduce((s, r) => s + r.hi * r.w, 0));

  const W = 600;
  const H = 260;
  const ymax = $derived(Math.max(...Array.from({ length: 101 }, (_, i) => F.f(F.a + ((F.b - F.a) * i) / 100))) * 1.1);
  const X = (x: number) => 30 + ((x - F.a) / (F.b - F.a)) * (W - 50);
  const Y = (y: number) => H - 20 - (y / ymax) * (H - 35);
  const graph = $derived(
    Array.from({ length: 300 }, (_, i) => F.a + ((F.b - F.a) * i) / 299)
      .map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(F.f(x)).toFixed(1)}`)
      .join(''),
  );
</script>

<Widget title="Trapping the area" subtitle="Lower sum (blue): rectangles under the curve. Upper sum (blue + red): rectangles over it. The true area is in between, and the red gap vanishes as n grows." onreset={() => (n = 6)}>
  {#snippet controls()}
    <label class="ctl">f <select bind:value={which}>{#each FNS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select></label>
    <label class="ctl">n = <strong class="num">{n}</strong> <input type="range" min="1" max="200" bind:value={n} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Upper and lower Riemann sums">
    <line x1="30" x2={W - 20} y1={Y(0)} y2={Y(0)} class="axis" />
    {#each rects as r, i (i)}
      <rect x={X(r.x)} y={Y(r.hi)} width={Math.max(0.5, X(r.x + r.w) - X(r.x))} height={Math.max(0, Y(r.lo) - Y(r.hi))} class="gap" />
      <rect x={X(r.x)} y={Y(r.lo)} width={Math.max(0.5, X(r.x + r.w) - X(r.x))} height={Math.max(0, Y(0) - Y(r.lo))} class="low" />
    {/each}
    <path d={graph} class="graph" />
  </svg>
  <p class="read num">
    lower = {lower.toFixed(5)} ≤ <Tex tex={`\\int_{${F.a === 0 ? 0 : F.a}}^{${F.name.includes('π') ? '\\pi' : F.name.includes('e]') ? 'e' : F.b}} ${F.tex}\\,dx = ${F.exactTex}`} /> ≈ {F.exact.toFixed(5)} ≤ upper = {upper.toFixed(5)} &nbsp; (gap {(upper - lower).toExponential(2)})
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .ctl input {
    width: 14rem;
  }
  select {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.1rem 0.3rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .low {
    fill: color-mix(in srgb, var(--byrne-blue) 55%, transparent);
    stroke: var(--surface);
    stroke-width: 0.5;
  }
  .gap {
    fill: color-mix(in srgb, var(--byrne-red) 55%, transparent);
    stroke: var(--surface);
    stroke-width: 0.5;
  }
  .graph {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }
  .read {
    font-size: 0.85rem;
    text-align: center;
    margin: 0.2rem 0 0;
  }
</style>
