<!--
  Continuity at a point, ε–δ style: the Sceptic sets a band of half-height ε around f(a); the
  Prover must find δ so that the graph over (a − δ, a + δ) stays inside the band.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  interface Fn {
    name: string;
    tex: string;
    f: (x: number) => number;
    a: number;
    R: number;
    strategy: ((eps: number) => number) | null;
    note: string;
  }
  const FNS: Fn[] = [
    { name: 'x² at a = 1', tex: 'f(x) = x^2,\\ a = 1', f: (x) => x * x, a: 1, R: 1.5, strategy: (e) => Math.min(1, e / 3), note: 'δ = min(1, ε/3) works: if |x − 1| < δ ≤ 1 then |x + 1| < 3, so |x² − 1| = |x − 1||x + 1| < 3δ ≤ ε.' },
    { name: '1/x at a = 1', tex: 'f(x) = \\tfrac1x,\\ a = 1', f: (x) => 1 / x, a: 1, R: 0.9, strategy: (e) => Math.min(0.5, e / 2), note: 'δ = min(½, ε/2): then x > ½, so |1/x − 1| = |x − 1|/x < 2δ ≤ ε. Near 0 the graph is steep, so δ must shrink.' },
    { name: 'x sin(1/x) at 0', tex: 'f(x) = x \\sin \\tfrac1x,\\ f(0) = 0', f: (x) => (x === 0 ? 0 : x * Math.sin(1 / x)), a: 0, R: 0.5, strategy: (e) => e, note: 'It wiggles infinitely often near 0, yet |f(x)| ≤ |x|, so δ = ε works: continuous.' },
    { name: 'a step at 0', tex: 'f(x) = \\begin{cases} 0 & x < 0 \\\\ 1 & x \\ge 0 \\end{cases}', f: (x) => (x < 0 ? 0 : 1), a: 0, R: 1, strategy: null, note: 'For ε < 1 no δ works: every interval around 0 contains points where f = 0, at distance 1 from f(0) = 1. Not continuous at 0.' },
    { name: 'sin(1/x) at 0', tex: 'f(x) = \\sin \\tfrac1x,\\ f(0) = 0', f: (x) => (x === 0 ? 0 : Math.sin(1 / x)), a: 0, R: 0.5, strategy: null, note: 'Every interval around 0 contains points where f = 1 and where f = −1: for ε < 1 no δ works.' },
  ];

  let which = $state(0);
  let logEps = $state(-0.7);
  let logDelta = $state(-0.5);
  const F = $derived(FNS[which]!);
  const eps = $derived(10 ** logEps);
  const delta = $derived(10 ** logDelta);
  const fa = $derived(F.f(F.a));

  const W = 600;
  const H = 300;
  const samples = $derived.by(() => {
    const out: { x: number; y: number }[] = [];
    const n = 1400;
    for (let i = 0; i <= n; i++) {
      const x = F.a - F.R + (2 * F.R * i) / n;
      out.push({ x, y: F.f(x) });
    }
    return out;
  });
  const yr = $derived.by(() => {
    const ys = samples.map((s) => s.y).filter(Number.isFinite);
    const lo = Math.max(Math.min(...ys), fa - 3);
    const hi = Math.min(Math.max(...ys), fa + 3);
    const pad = (hi - lo) * 0.1 + 0.05;
    return [lo - pad, hi + pad] as const;
  });
  const X = (x: number) => 30 + ((x - (F.a - F.R)) / (2 * F.R)) * (W - 45);
  const Y = (y: number) => H - 20 - ((y - yr[0]) / (yr[1] - yr[0])) * (H - 35);
  const segs = $derived.by(() => {
    // Split the graph into pieces; colour the part over (a − δ, a + δ) by whether it leaves the band.
    let d = '';
    let bad = '';
    let prev: { x: number; y: number } | null = null;
    for (const s of samples) {
      if (!Number.isFinite(s.y) || s.y < yr[0] - 5 || s.y > yr[1] + 5) {
        prev = null;
        continue;
      }
      const jump = prev && Math.abs(s.y - prev.y) > (yr[1] - yr[0]) * 0.5;
      const inWindow = Math.abs(s.x - F.a) < delta;
      const escaping = inWindow && Math.abs(s.y - fa) >= eps;
      const cmd = !prev || jump ? 'M' : 'L';
      d += `${cmd}${X(s.x).toFixed(1)},${Y(s.y).toFixed(1)}`;
      if (escaping) bad += `M${X(s.x).toFixed(1)},${Y(s.y).toFixed(1)}l0.01,0`;
      prev = s;
    }
    return { d, bad };
  });
  const ok = $derived(samples.every((s) => Math.abs(s.x - F.a) >= delta || Math.abs(s.y - fa) < eps));
</script>

<Widget title="The ε–δ game" subtitle="Blue band: within ε of f(a). Yellow strip: within δ of a. The Prover wins if, over the yellow strip, the graph never leaves the blue band (red marks where it does)." onreset={() => ((logEps = -0.7), (logDelta = -0.5))}>
  {#snippet controls()}
    <label class="ctl">function <select bind:value={which}>{#each FNS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select></label>
    <label class="ctl">ε = <strong class="num">{eps.toPrecision(2)}</strong> <input type="range" min="-2" max="0" step="0.01" bind:value={logEps} /></label>
    <label class="ctl">δ = <strong class="num">{delta.toPrecision(2)}</strong> <input type="range" min="-3" max={Math.log10(F.R)} step="0.01" bind:value={logDelta} /></label>
    {#if F.strategy}<button onclick={() => (logDelta = Math.log10(F.strategy!(eps)))}>Prover’s δ</button>{/if}
  {/snippet}
  <p class="def"><Tex tex={F.tex} /></p>
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Graph of the function with the epsilon band and delta strip">
    <rect x="30" y={Y(fa + eps)} width={W - 45} height={Math.max(1, Y(fa - eps) - Y(fa + eps))} class="band" />
    <rect x={X(F.a - delta)} y="10" width={Math.max(1, X(F.a + delta) - X(F.a - delta))} height={H - 30} class="strip" />
    <path d={segs.d} class="graph" />
    <path d={segs.bad} class="bad" />
    <circle cx={X(F.a)} cy={Y(fa)} r="4" class="pt" />
  </svg>
  <p class="verdict" class:ok class:no={!ok}>{ok ? `✓ This δ works for this ε.` : `✗ The graph escapes the band inside the strip. Shrink δ${F.strategy ? '' : ' — or discover that nothing works'}.`}</p>
  <p class="note">{F.note}</p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
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
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--accent);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .def {
    text-align: center;
    margin: 0 0 0.3rem;
  }
  .band {
    fill: color-mix(in srgb, var(--byrne-blue) 18%, transparent);
  }
  .strip {
    fill: color-mix(in srgb, var(--byrne-yellow) 18%, transparent);
  }
  .graph {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.6;
  }
  .bad {
    fill: none;
    stroke: var(--byrne-red);
    stroke-width: 5;
    stroke-linecap: round;
  }
  .pt {
    fill: var(--byrne-blue);
    stroke: var(--byrne-ink);
  }
  .verdict {
    margin: 0.2rem 0 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .ok {
    color: var(--ok);
  }
  .no {
    color: var(--bad);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.2rem 0 0;
  }
</style>
