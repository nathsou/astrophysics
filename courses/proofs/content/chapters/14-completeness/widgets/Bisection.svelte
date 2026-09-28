<!--
  Bolzano's bisection: a continuous function that changes sign on [a, b] has a zero. Halve the
  interval, keep the half where the sign still changes, repeat. The intervals shrink onto a single
  real number — which exists because ℝ is complete. In ℚ the same process can close in on a gap.
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
    note: string;
  }
  const FNS: Fn[] = [
    { name: 'x² − 2', tex: 'f(x) = x^2 - 2', f: (x) => x * x - 2, a: 1, b: 2, note: 'The intervals close in on √2 = 1.41421356… In the rationals there is nothing there: the nested intervals have no common point in ℚ.' },
    { name: 'x³ − x − 1', tex: 'f(x) = x^3 - x - 1', f: (x) => x ** 3 - x - 1, a: 1, b: 2, note: 'The “plastic number” 1.3247…, the real root of x³ = x + 1.' },
    { name: 'cos x − x', tex: 'f(x) = \\cos x - x', f: (x) => Math.cos(x) - x, a: 0, b: 1, note: 'The Dottie number 0.7390…: press cos repeatedly on a calculator (in radians) and you converge to it.' },
    { name: 'eˣ − 3', tex: 'f(x) = e^x - 3', f: (x) => Math.exp(x) - 3, a: 0, b: 2, note: 'ln 3 = 1.0986…' },
  ];

  let which = $state(0);
  let steps = $state<{ a: number; b: number }[]>([]);
  const F = $derived(FNS[which]!);
  $effect(() => {
    steps = [{ a: FNS[which]!.a, b: FNS[which]!.b }];
  });
  const cur = $derived(steps.at(-1) ?? { a: F.a, b: F.b });

  function halve() {
    const { a, b } = cur;
    const m = (a + b) / 2;
    const fm = F.f(m);
    if (fm === 0) steps = [...steps, { a: m, b: m }];
    else if (Math.sign(fm) === Math.sign(F.f(a))) steps = [...steps, { a: m, b }];
    else steps = [...steps, { a, b: m }];
  }
  function many() {
    for (let i = 0; i < 10; i++) halve();
  }

  const W = 620;
  const H = 240;
  const X = (x: number) => 30 + ((x - F.a) / (F.b - F.a)) * (W - 50);
  const yr = $derived.by(() => {
    const ys = Array.from({ length: 101 }, (_, i) => F.f(F.a + ((F.b - F.a) * i) / 100));
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    return [lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1] as const;
  });
  const Y = (y: number) => 15 + ((yr[1] - y) / (yr[1] - yr[0])) * (H - 60);
  const path = $derived(
    Array.from({ length: 301 }, (_, i) => F.a + ((F.b - F.a) * i) / 300)
      .map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(F.f(x)).toFixed(1)}`)
      .join(''),
  );
  const width = $derived(cur.b - cur.a);
  const digits = $derived(Math.max(2, Math.min(12, Math.ceil(-Math.log10(width || 1e-12)) + 1)));
</script>

<Widget title="Hunting a zero by bisection" subtitle="f(a) and f(b) have opposite signs. Halve the interval and keep the half on which the sign still changes. Each step halves the uncertainty." onreset={() => (steps = [{ a: F.a, b: F.b }])}>
  {#snippet controls()}
    <label class="ctl">function <select bind:value={which}>{#each FNS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select></label>
    <button onclick={halve}>Halve</button>
    <button onclick={many}>Halve 10 times</button>
    <span class="count num">step {steps.length - 1}</span>
  {/snippet}
  <p class="def"><Tex tex={F.tex} /></p>
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Graph with nested intervals around a zero">
    <line x1="30" x2={W - 20} y1={Y(0)} y2={Y(0)} class="axis" />
    <path d={path} class="graph" />
    {#each steps.slice(-8) as s, i (Math.max(0, steps.length - 8) + i)}
      <rect x={X(s.a)} y={H - 42 + i * 5} width={Math.max(1.5, X(s.b) - X(s.a))} height="4" class="int" style:opacity={0.3 + (0.7 * (i + 1)) / Math.min(8, steps.length)} />
    {/each}
    <rect x={X(cur.a)} y="10" width={Math.max(1.5, X(cur.b) - X(cur.a))} height={H - 55} class="cur" />
  </svg>
  <p class="read num">
    [{cur.a.toFixed(digits)}, {cur.b.toFixed(digits)}] &nbsp; width {width.toExponential(2)}
  </p>
  <p class="note">{F.note}</p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select,
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .count {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .def {
    text-align: center;
    margin: 0 0 0.2rem;
  }
  .axis {
    stroke: var(--ink-3);
  }
  .graph {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.8;
  }
  .int {
    fill: var(--byrne-red);
  }
  .cur {
    fill: color-mix(in srgb, var(--byrne-yellow) 22%, transparent);
    stroke: var(--byrne-yellow);
  }
  .read {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    text-align: center;
    margin: 0.2rem 0 0;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
</style>
