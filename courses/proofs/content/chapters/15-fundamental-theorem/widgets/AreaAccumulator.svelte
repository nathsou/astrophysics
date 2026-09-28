<!--
  The fundamental theorem of calculus, part 1: the accumulated area F(x) = ∫ₐˣ f grows at rate f(x).
  Top: the area under f up to x. Bottom: the graph of F, with its tangent at x — whose slope is f(x).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  interface Fn {
    name: string;
    f: (x: number) => number;
    a: number;
    b: number;
  }
  const FNS: Fn[] = [
    { name: 'cos x', f: Math.cos, a: 0, b: 2 * Math.PI },
    { name: 'x² − 1', f: (x) => x * x - 1, a: -1.8, b: 1.8 },
    { name: 'e^(−x²)', f: (x) => Math.exp(-x * x), a: -2.5, b: 2.5 },
    { name: 'sin(x²)', f: (x) => Math.sin(x * x), a: 0, b: 3.3 },
  ];
  let which = $state(0);
  let t = $state(0.4);
  const F = $derived(FNS[which]!);
  const N = 600;
  const xs = $derived(Array.from({ length: N + 1 }, (_, i) => F.a + ((F.b - F.a) * i) / N));
  const cum = $derived.by(() => {
    const out = [0];
    for (let i = 1; i <= N; i++) out.push(out[i - 1]! + ((F.f(xs[i - 1]!) + F.f(xs[i]!)) / 2) * ((F.b - F.a) / N));
    return out;
  });
  const idx = $derived(Math.round(t * N));
  const x0 = $derived(xs[idx]!);
  const W = 600;
  const H1 = 170;
  const H2 = 170;
  const fr = $derived.by(() => {
    const ys = xs.map(F.f);
    const lo = Math.min(0, ...ys);
    const hi = Math.max(0, ...ys);
    return [lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1] as const;
  });
  const Fr = $derived.by(() => {
    const lo = Math.min(0, ...cum);
    const hi = Math.max(0, ...cum);
    return [lo - (hi - lo) * 0.15, hi + (hi - lo) * 0.15] as const;
  });
  const X = (x: number) => 30 + ((x - F.a) / (F.b - F.a)) * (W - 50);
  const Y1 = (y: number) => 8 + ((fr[1] - y) / (fr[1] - fr[0])) * (H1 - 16);
  const Y2 = (y: number) => 8 + ((Fr[1] - y) / (Fr[1] - Fr[0])) * (H2 - 16);
  const fPath = $derived(xs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y1(F.f(x)).toFixed(1)}`).join(''));
  const area = $derived(`M${X(F.a)},${Y1(0)}` + xs.slice(0, idx + 1).map((x) => `L${X(x).toFixed(1)},${Y1(F.f(x)).toFixed(1)}`).join('') + `L${X(x0)},${Y1(0)}Z`);
  const FPath = $derived(xs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y2(cum[i]!).toFixed(1)}`).join(''));
  const slope = $derived(F.f(x0));
  const L = $derived((F.b - F.a) * 0.12);
</script>

<Widget title="Area as a function" subtitle="Drag x. Above: the signed area under f from a to x. Below: that area, F(x), as a graph. The tangent to F at x always has slope f(x)." onreset={() => (t = 0.4)}>
  {#snippet controls()}
    <label class="ctl">f(x) = <select bind:value={which}>{#each FNS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select></label>
    <label class="ctl">x <input type="range" min="0" max="1" step="0.001" bind:value={t} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} {H1 + H2 + 10}" width="100%" role="img" aria-label="Area under f and the accumulated area function">
    <g>
      <line x1="30" x2={W - 20} y1={Y1(0)} y2={Y1(0)} class="axis" />
      <path d={area} class="area" class:neg={false} />
      <path d={fPath} class="graph" />
      <line x1={X(x0)} x2={X(x0)} y1={Y1(0)} y2={Y1(slope)} class="height" />
      <text x="34" y="18" class="lab">y = f(t)</text>
    </g>
    <g transform="translate(0,{H1 + 10})">
      <line x1="30" x2={W - 20} y1={Y2(0)} y2={Y2(0)} class="axis" />
      <path d={FPath} class="Fgraph" />
      <line x1={X(x0 - L)} y1={Y2(cum[idx]! - slope * L)} x2={X(x0 + L)} y2={Y2(cum[idx]! + slope * L)} class="tan" />
      <circle cx={X(x0)} cy={Y2(cum[idx]!)} r="5" class="pt" />
      <text x="34" y="18" class="lab">y = F(x) = ∫ f</text>
    </g>
  </svg>
  <p class="read num">x = {x0.toFixed(3)}: &nbsp; F(x) = {cum[idx]!.toFixed(4)}, &nbsp; slope of F = f(x) = <strong>{slope.toFixed(4)}</strong></p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .ctl input {
    width: 18rem;
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
  .area {
    fill: color-mix(in srgb, var(--byrne-blue) 40%, transparent);
  }
  .graph {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }
  .height {
    stroke: var(--byrne-red);
    stroke-width: 3;
  }
  .Fgraph {
    fill: none;
    stroke: var(--byrne-blue);
    stroke-width: 2;
  }
  .tan {
    stroke: var(--byrne-red);
    stroke-width: 2.5;
  }
  .pt {
    fill: var(--byrne-red);
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
    font-family: var(--font-ui);
  }
  .read {
    font-size: 0.85rem;
    text-align: center;
    margin: 0.2rem 0 0;
  }
</style>
