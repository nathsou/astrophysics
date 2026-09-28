<!--
  Dirichlet's approximation theorem by pigeonholes: the N + 1 fractional parts of 0, α, 2α, …, Nα
  fall into N boxes of width 1/N, so two share a box; their difference gives q with qα within 1/N
  of an integer p, i.e. |α − p/q| < 1/(qN).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const NUMS = [
    { name: 'π', v: Math.PI },
    { name: '√2', v: Math.SQRT2 },
    { name: 'e', v: Math.E },
    { name: 'φ (golden ratio)', v: (1 + Math.sqrt(5)) / 2 },
  ];
  let which = $state(0);
  let N = $state(8);
  const alpha = $derived(NUMS[which]!.v);
  const frac = (x: number) => x - Math.floor(x);
  const pts = $derived(Array.from({ length: N + 1 }, (_, k) => ({ k, f: frac(k * alpha) })));
  const box = (f: number) => Math.min(N - 1, Math.floor(f * N));
  const collision = $derived.by(() => {
    const seen = new Map<number, number>();
    for (const p of pts) {
      const b = box(p.f);
      if (seen.has(b)) return { i: seen.get(b)!, j: p.k, b };
      seen.set(b, p.k);
    }
    return null;
  });
  const approx = $derived.by(() => {
    if (!collision) return null;
    const q = collision.j - collision.i;
    const p = Math.round(q * alpha);
    return { p, q, err: Math.abs(alpha - p / q) };
  });
  const W = 620;
  const X = (f: number) => 20 + f * (W - 40);
</script>

<Widget title="Pigeonholes for fractions" subtitle="Mark the fractional parts of 0, α, 2α, …, Nα on [0, 1), cut into N boxes. N + 1 points, N boxes: two points must share a box." onreset={() => (N = 8)}>
  {#snippet controls()}
    <label class="ctl">α = <select bind:value={which}>{#each NUMS as n, i (i)}<option value={i}>{n.name}</option>{/each}</select></label>
    <label class="ctl">N = <strong>{N}</strong> <input type="range" min="2" max="120" bind:value={N} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} 110" width="100%" role="img" aria-label="Fractional parts of multiples of alpha in {N} boxes">
    {#each Array.from({ length: N }, (_, b) => b) as b (b)}
      <rect x={X(b / N)} y="30" width={(W - 40) / N} height="40" class="box" class:hot={collision?.b === b} />
    {/each}
    {#each pts as p (p.k)}
      <circle cx={X(p.f)} cy="50" r={N > 60 ? 2.5 : 4} class="pt" class:hot={collision && (p.k === collision.i || p.k === collision.j)} />
      {#if N <= 20}<text x={X(p.f)} y={p.k % 2 ? 90 : 22} class="lab">{p.k}α</text>{/if}
    {/each}
  </svg>
  {#if collision && approx}
    <p class="read num">
      {collision.i}α and {collision.j}α share box {collision.b + 1}, so q = {approx.q} gives qα = {(approx.q * alpha).toFixed(5)}, within 1/N of p = {approx.p}.
      Fraction <strong>{approx.p}/{approx.q}</strong>: |α − p/q| = {approx.err.toExponential(2)} &lt; 1/(qN) = {(1 / (approx.q * N)).toExponential(2)} ≤ 1/q² = {(1 / (approx.q * approx.q)).toExponential(2)}.
    </p>
  {/if}
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
  .box {
    fill: var(--surface-2);
    stroke: var(--rule-strong);
    stroke-width: 0.8;
  }
  .box.hot {
    fill: color-mix(in srgb, var(--byrne-red) 20%, var(--surface));
  }
  .pt {
    fill: var(--byrne-blue);
    stroke: var(--byrne-ink);
    stroke-width: 0.6;
  }
  .pt.hot {
    fill: var(--byrne-red);
  }
  .lab {
    font-size: 9px;
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .read {
    font-size: 0.82rem;
    margin: 0.2rem 0 0;
  }
</style>
