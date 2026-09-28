<!--
  Bhāskara's figure: the square on the hypotenuse holds four copies of the triangle and a small
  square of side b − a in the middle.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let a = $state(1.8);
  let b = $state(3.2);
  const W = 300;
  const lo = $derived(Math.min(a, b));
  const hi = $derived(Math.max(a, b));
  const c = $derived(Math.hypot(lo, hi));
  // Square on the hypotenuse, tilted; vertices of the outer square in maths coordinates.
  const s = $derived((W - 20) / (lo + hi));
  const P = (x: number, y: number) => `${10 + x * s},${W - 10 - y * s}`;
  // Outer square: (lo,0), (lo+hi, lo), (hi, lo+hi), (0, hi). Inner square side hi − lo.
  const tris = $derived([
    [P(lo, 0), P(lo + hi, lo), P(lo, lo)],
    [P(lo + hi, lo), P(hi, lo + hi), P(hi, lo)],
    [P(hi, lo + hi), P(0, hi), P(hi, hi)],
    [P(0, hi), P(lo, 0), P(lo, hi)],
  ]);
  const inner = $derived([P(lo, lo), P(hi, lo), P(hi, hi), P(lo, hi)].join(' '));
  const colours = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--byrne-red)'];
</script>

<Widget title="Bhāskara’s figure" subtitle="“Behold!” Four triangles and a small square fill the square on the hypotenuse." onreset={() => ((a = 1.8), (b = 3.2))}>
  {#snippet controls()}
    <label class="ctl">a <input type="range" min="0.5" max="4" step="0.05" bind:value={a} aria-label="Leg a" /></label>
    <label class="ctl">b <input type="range" min="0.5" max="4" step="0.05" bind:value={b} aria-label="Leg b" /></label>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {W} {W}" width="100%" style:max-width="{W}px" role="img" aria-label="A square of side c split into four right triangles and a central square">
      {#each tris as t, i (i)}
        <polygon points={t.join(' ')} fill={colours[i]} class="piece" />
      {/each}
      <polygon points={inner} class="inner" />
    </svg>
    <p class="read ui num">
      4 · ½ab + (b − a)² = {(2 * lo * hi).toFixed(2)} + {((hi - lo) ** 2).toFixed(2)} = {(2 * lo * hi + (hi - lo) ** 2).toFixed(2)} &nbsp;·&nbsp; c² = {(c * c).toFixed(2)}
    </p>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-style: italic;
  }
  .wrap {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
  }
  .piece {
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .inner {
    fill: var(--surface);
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
  }
  .read {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
</style>
