<!--
  Pointwise versus uniform convergence. Continuous functions fₙ converge at every point, but the
  limit jumps. An ε-tube around the limit never contains the whole graph of fₙ: the convergence
  is not uniform, which is exactly why continuity can be lost in the limit.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  const EXAMPLES = [
    {
      name: 'xⁿ on [0, 1]',
      tex: 'f_n(x) = x^n \\to \\begin{cases} 0 & x < 1 \\\\ 1 & x = 1 \\end{cases}',
      f: (x: number, n: number) => x ** n,
      lim: (x: number) => (x >= 1 ? 1 : 0),
      a: 0,
      b: 1,
      jump: 1,
    },
    {
      name: 'Fourier series of a square wave (Abel, 1826)',
      tex: 'f_n(x) = \\tfrac4\\pi \\sum_{k=0}^{n-1} \\tfrac{\\sin((2k+1)x)}{2k+1} \\to \\operatorname{sign}(x)',
      f: (x: number, n: number) => {
        let s = 0;
        for (let k = 0; k < n; k++) s += Math.sin((2 * k + 1) * x) / (2 * k + 1);
        return (4 / Math.PI) * s;
      },
      lim: (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0),
      a: -Math.PI,
      b: Math.PI,
      jump: 2,
    },
  ];

  let which = $state(1);
  let n = $state(8);
  let eps = $state(0.15);
  const E = $derived(EXAMPLES[which]!);
  const W = 600;
  const H = 260;
  const yr = $derived(which === 0 ? ([-0.2, 1.25] as const) : ([-1.45, 1.45] as const));
  const X = (x: number) => 25 + ((x - E.a) / (E.b - E.a)) * (W - 40);
  const Y = (y: number) => 10 + ((yr[1] - y) / (yr[1] - yr[0])) * (H - 20);
  const xs = $derived(Array.from({ length: 900 }, (_, i) => E.a + ((E.b - E.a) * i) / 899));
  const graph = $derived(xs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(E.f(x, n)).toFixed(1)}`).join(''));
  const escapes = $derived(xs.filter((x) => Math.abs(E.f(x, n) - E.lim(x)) >= eps));
  const worst = $derived(Math.max(...xs.map((x) => Math.abs(E.f(x, n) - E.lim(x)))));
  // Tube around the limit, drawn piece by piece (it jumps with the limit).
  const tube = $derived.by(() => {
    if (which === 0) return [{ x1: E.a, x2: E.b - 0.002, y: 0 }];
    return [
      { x1: E.a, x2: -0.002, y: -1 },
      { x1: 0.002, x2: E.b, y: 1 },
    ];
  });
</script>

<Widget title="Where continuity is lost" subtitle="Each fₙ is continuous and fₙ(x) converges for every x — but the limit jumps. The blue tube is everything within ε of the limit. Can you find an n that puts the whole graph inside?" onreset={() => ((n = 8), (eps = 0.15))}>
  {#snippet controls()}
    <label class="ctl"><select bind:value={which}>{#each EXAMPLES as e, i (i)}<option value={i}>{e.name}</option>{/each}</select></label>
    <label class="ctl">n = <strong>{n}</strong> <input type="range" min="1" max="200" bind:value={n} /></label>
    <label class="ctl">ε = <strong>{eps.toFixed(2)}</strong> <input type="range" min="0.02" max="0.5" step="0.01" bind:value={eps} /></label>
  {/snippet}
  <p class="def"><Tex tex={E.tex} /></p>
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="A sequence of functions and an epsilon tube around its limit">
    {#each tube as t, i (i)}
      <rect x={X(t.x1)} y={Y(t.y + eps)} width={X(t.x2) - X(t.x1)} height={Y(t.y - eps) - Y(t.y + eps)} class="tube" />
    {/each}
    <line x1="25" x2={W - 15} y1={Y(0)} y2={Y(0)} class="axis" />
    <path d={graph} class="graph" />
    {#each escapes.filter((_, i) => i % 3 === 0) as x (x)}
      <circle cx={X(x)} cy={Y(E.f(x, n))} r="2" class="esc" />
    {/each}
  </svg>
  <p class="read num">
    largest distance from the limit: <strong>{worst.toFixed(3)}</strong>
    {#if which === 1}— close to 1 for every n, because the graph must climb continuously from −1 to 1 near the jump. And it overshoots: its maximum is {Math.max(...xs.map((x) => E.f(x, n))).toFixed(3)}, about 9% of the jump above 1, however large n is (the Gibbs phenomenon).{:else}— close to 1 for every n, just to the left of x = 1.{/if}
  </p>
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
  .def {
    text-align: center;
    margin: 0 0 0.2rem;
  }
  .tube {
    fill: color-mix(in srgb, var(--byrne-blue) 20%, transparent);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .graph {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.6;
  }
  .esc {
    fill: var(--byrne-red);
  }
  .read {
    font-size: 0.82rem;
    margin: 0.2rem 0 0;
    text-align: center;
  }
</style>
