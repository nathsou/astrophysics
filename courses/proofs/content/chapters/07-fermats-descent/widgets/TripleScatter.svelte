<!--
  Every Pythagorean triple (a, b, c) with c up to a bound, plotted as the point (a, b). Primitive
  triples (m² − n², 2mn, m² + n²) are highlighted; their multiples lie on rays through the origin.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let N = $state(600);
  let hover = $state<{ a: number; b: number; c: number; prim: boolean } | null>(null);

  const points = $derived.by(() => {
    const out: { a: number; b: number; c: number; prim: boolean }[] = [];
    const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
    for (let m = 2; m * m < 2 * N; m++)
      for (let n = 1; n < m; n++) {
        if ((m - n) % 2 === 0 || g(m, n) !== 1) continue;
        const [a, b, c] = [m * m - n * n, 2 * m * n, m * m + n * n];
        for (let k = 1; k * c <= N; k++) {
          out.push({ a: k * a, b: k * b, c: k * c, prim: k === 1 });
          out.push({ a: k * b, b: k * a, c: k * c, prim: k === 1 });
        }
      }
    return out;
  });
  const primCount = $derived(points.filter((p) => p.prim).length / 2);

  const S = 420;
  const X = (a: number) => 30 + (a / N) * (S - 40);
  const Y = (b: number) => S - 30 - (b / N) * (S - 40);
</script>

<Widget title="All Pythagorean triples" subtitle="Each dot (a, b) is a right triangle with whole-number sides a, b, c ≤ bound. Hover a dot. Large dots are primitive (no common factor); the others are their multiples." onreset={() => (N = 600)}>
  {#snippet controls()}
    <label class="ctl">c ≤ <strong class="num">{N}</strong> <input type="range" min="50" max="2500" step="50" bind:value={N} /></label>
    <span class="count num">{points.length / 2} triples with a &lt; b, {primCount} primitive</span>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {S} {S}" width="100%" style:max-width="{S}px" role="img" aria-label="Scatter plot of Pythagorean triples">
      <line x1="30" x2={S - 10} y1={S - 30} y2={S - 30} class="axis" />
      <line x1="30" x2="30" y1="10" y2={S - 30} class="axis" />
      <text x={S - 10} y={S - 14} class="lab">a</text>
      <text x="16" y="16" class="lab">b</text>
      {#each points as pt, i (i)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <circle cx={X(pt.a)} cy={Y(pt.b)} r={pt.prim ? 2.6 : 1.3} class:prim={pt.prim} onmouseenter={() => (hover = pt)} onmouseleave={() => (hover = null)} />
      {/each}
    </svg>
    <p class="hov num">{#if hover}({hover.a}, {hover.b}, {hover.c}) — {hover.a}² + {hover.b}² = {hover.a * hover.a + hover.b * hover.b} = {hover.c}²{hover.prim ? ' · primitive' : ''}{:else}&nbsp;{/if}</p>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .count {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .wrap {
    display: grid;
    justify-items: center;
  }
  .axis {
    stroke: var(--rule-strong);
  }
  .lab {
    font-family: var(--font-body);
    font-style: italic;
    fill: var(--ink-2);
    font-size: 14px;
  }
  circle {
    fill: var(--byrne-blue);
    opacity: 0.55;
  }
  circle.prim {
    fill: var(--byrne-red);
    opacity: 0.9;
  }
  circle:hover {
    stroke: var(--ink);
    stroke-width: 2;
  }
  .hov {
    font-size: 0.85rem;
    margin: 0.3rem 0 0;
    min-height: 1.3em;
  }
</style>
