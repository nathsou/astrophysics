<!--
  The mean value theorem: somewhere between a and b the tangent is parallel to the chord.
  Slide c and watch the tangent turn; the points where it matches the chord's slope are marked.
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
    smooth: boolean;
  }
  const FNS: Fn[] = [
    { name: 'x³ − 3x', tex: 'x^3 - 3x', f: (x) => x ** 3 - 3 * x, a: -2, b: 2.2, smooth: true },
    { name: 'sin x + x/3', tex: '\\sin x + x/3', f: (x) => Math.sin(x) + x / 3, a: 0, b: 7, smooth: true },
    { name: '√x', tex: '\\sqrt{x}', f: (x) => Math.sqrt(x), a: 0, b: 4, smooth: true },
    { name: '|x| (not differentiable at 0)', tex: '|x|', f: (x) => Math.abs(x), a: -1, b: 1, smooth: false },
  ];
  let which = $state(0);
  let t = $state(0.3);
  const F = $derived(FNS[which]!);
  const slope = $derived((F.f(F.b) - F.f(F.a)) / (F.b - F.a));
  const d = (x: number) => (F.f(x + 1e-5) - F.f(x - 1e-5)) / 2e-5;
  const c = $derived(F.a + t * (F.b - F.a));
  const mvt = $derived.by(() => {
    const out: number[] = [];
    if (!F.smooth) return out;
    const n = 2000;
    let prev = d(F.a + (F.b - F.a) * 0.0005) - slope;
    for (let i = 1; i < n; i++) {
      const x = F.a + ((F.b - F.a) * i) / n;
      const v = d(x) - slope;
      if (Math.sign(v) !== Math.sign(prev) && Math.abs(v - prev) < 5) out.push(x);
      prev = v;
    }
    return out;
  });

  const W = 600;
  const H = 280;
  const pad = $derived((F.b - F.a) * 0.08);
  const yr = $derived.by(() => {
    const ys = Array.from({ length: 201 }, (_, i) => F.f(F.a - pad + ((F.b - F.a + 2 * pad) * i) / 200));
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    return [lo - (hi - lo) * 0.12, hi + (hi - lo) * 0.12] as const;
  });
  const X = (x: number) => 20 + ((x - (F.a - pad)) / (F.b - F.a + 2 * pad)) * (W - 40);
  const Y = (y: number) => 10 + ((yr[1] - y) / (yr[1] - yr[0])) * (H - 20);
  const graph = $derived(
    Array.from({ length: 400 }, (_, i) => F.a - pad + ((F.b - F.a + 2 * pad) * i) / 399)
      .filter((x) => !(F.name.startsWith('√') && x < 0))
      .map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(F.f(x)).toFixed(1)}`)
      .join(''),
  );
  const tangentAt = (x: number, m: number) => {
    const L = (F.b - F.a) * 0.35;
    return { x1: X(x - L), y1: Y(F.f(x) - m * L), x2: X(x + L), y2: Y(F.f(x) + m * L) };
  };
  const tc = $derived(tangentAt(c, d(c)));
  const matches = $derived(Math.abs(d(c) - slope) < 0.02 * Math.max(1, Math.abs(slope)));
</script>

<Widget title="The mean value theorem" subtitle="The chord from (a, f(a)) to (b, f(b)) has some slope. Slide c: somewhere the tangent is parallel to the chord (marked in red)." onreset={() => (t = 0.3)}>
  {#snippet controls()}
    <label class="ctl">f(x) = <select bind:value={which}>{#each FNS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select></label>
    <label class="ctl">c <input type="range" min="0.001" max="0.999" step="0.001" bind:value={t} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Graph of f with its chord and a tangent line">
    <line x1={X(F.a)} y1={Y(F.f(F.a))} x2={X(F.b)} y2={Y(F.f(F.b))} class="chord" />
    <path d={graph} class="graph" />
    {#each mvt as m (m)}
      {@const tl = tangentAt(m, slope)}
      <line {...tl} class="ghost" />
      <circle cx={X(m)} cy={Y(F.f(m))} r="5" class="mvt" />
    {/each}
    <line x1={tc.x1} y1={tc.y1} x2={tc.x2} y2={tc.y2} class="tan" class:match={matches} />
    <circle cx={X(c)} cy={Y(F.f(c))} r="5" class="c" />
    <circle cx={X(F.a)} cy={Y(F.f(F.a))} r="4" class="end" />
    <circle cx={X(F.b)} cy={Y(F.f(F.b))} r="4" class="end" />
  </svg>
  <p class="read num">
    <Tex tex={`f(x) = ${F.tex}`} /> &nbsp; chord slope <Tex tex={`\\tfrac{f(b) - f(a)}{b - a} = ${slope.toFixed(3)}`} />, &nbsp; <Tex tex={`f'(c) = ${d(c).toFixed(3)}`} />
    {#if !F.smooth}<br /><span class="warn">|x| has no derivative at 0, the chord has slope 0, and no tangent is horizontal: the theorem needs differentiability.</span>{/if}
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
    width: 16rem;
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
  .graph {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
  }
  .chord {
    stroke: var(--byrne-blue);
    stroke-width: 2;
  }
  .tan {
    stroke: var(--byrne-yellow);
    stroke-width: 2.5;
  }
  .tan.match {
    stroke: var(--byrne-red);
  }
  .ghost {
    stroke: var(--byrne-red);
    stroke-dasharray: 4 4;
    opacity: 0.5;
  }
  .mvt {
    fill: var(--byrne-red);
  }
  .c {
    fill: var(--byrne-yellow);
    stroke: var(--byrne-ink);
  }
  .end {
    fill: var(--byrne-blue);
  }
  .read {
    font-size: 0.85rem;
    text-align: center;
    margin: 0.2rem 0 0;
  }
  .warn {
    color: var(--maybe);
    font-size: 0.8rem;
  }
</style>
