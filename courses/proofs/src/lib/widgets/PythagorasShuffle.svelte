<!--
  The rearrangement proof of Pythagoras' theorem: four copies of a right triangle in a square of
  side a + b leave either the square on the hypotenuse (c²) or the squares on the legs (a² + b²)
  uncovered. The triangles only ever slide — no rotation — so the uncovered areas must be equal.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  let {
    a: a0 = 3,
    b: b0 = 4,
    auto = false,
    controls = false,
    size = 320,
  }: { a?: number; b?: number; auto?: boolean; controls?: boolean; size?: number } = $props();

  let a = $state(a0);
  let b = $state(b0);
  let split = $state(false);

  const L = $derived(a + b);
  const s = $derived(size / L);
  // Canonical triangle: right angle at the origin, leg a along x, leg b along y.
  const tri = $derived(`0,0 ${a * s},0 0,${b * s}`);
  // Rotation (degrees) and right-angle position in the two configurations.
  const T = $derived([
    { rot: 0, A: [0, 0], B: [0, a], fill: 'var(--byrne-red)' },
    { rot: 90, A: [L, 0], B: [L, 0], fill: 'var(--byrne-blue)' },
    { rot: 180, A: [L, L], B: [a, L], fill: 'var(--byrne-yellow)' },
    { rot: 270, A: [0, L], B: [a, a], fill: 'var(--byrne-red)' },
  ]);

  onMount(() => {
    if (!auto) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => (split = !split), 3200);
    return () => clearInterval(id);
  });

  const c = $derived(Math.hypot(a, b));
</script>

<div class="pyth ui">
  <svg viewBox="-2 -2 {size + 4} {size + 4}" width="100%" style:max-width="{size}px" role="img" aria-label="Four right triangles in a square of side a plus b, leaving {split ? 'squares of area a squared and b squared' : 'a square of area c squared'} uncovered">
    <rect x="0" y="0" width={size} height={size} class="frame" />
    <!-- uncovered regions -->
    {#if split}
      <rect x="0" y="0" width={a * s} height={a * s} class="hole" />
      <rect x={a * s} y={a * s} width={b * s} height={b * s} class="hole" />
    {:else}
      <polygon points="{a * s},0 {L * s},{a * s} {b * s},{L * s} 0,{b * s}" class="hole" />
    {/if}
    {#each T as t, i (i)}
      {@const p = split ? t.B : t.A}
      <g class="t" style:transform="translate({p[0]! * s}px, {p[1]! * s}px) rotate({t.rot}deg)">
        <polygon points={tri} fill={t.fill} />
      </g>
    {/each}
    <g class="labels">
      {#if split}
        <text x={(a * s) / 2} y={(a * s) / 2}>a²</text>
        <text x={a * s + (b * s) / 2} y={a * s + (b * s) / 2}>b²</text>
      {:else}
        <text x={(L * s) / 2} y={(L * s) / 2}>c²</text>
      {/if}
    </g>
  </svg>
  {#if controls}
    <div class="ctl">
      <label>a = {a.toFixed(1)} <input type="range" min="1" max="6" step="0.1" bind:value={a} /></label>
      <label>b = {b.toFixed(1)} <input type="range" min="1" max="6" step="0.1" bind:value={b} /></label>
      <button onclick={() => (split = !split)}>{split ? 'Show c²' : 'Rearrange'}</button>
    </div>
    <p class="read num">
      Uncovered area: {split ? `a² + b² = ${(a * a).toFixed(2)} + ${(b * b).toFixed(2)} = ${(a * a + b * b).toFixed(2)}` : `c² = ${(c * c).toFixed(2)}`}
    </p>
  {/if}
</div>

<style>
  .pyth {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
  }
  .frame {
    fill: var(--surface);
    stroke: var(--byrne-ink);
    stroke-width: 2;
  }
  .hole {
    fill: color-mix(in srgb, var(--byrne-ink) 6%, var(--surface));
  }
  .t {
    transition: transform 1.1s cubic-bezier(0.65, 0, 0.35, 1);
  }
  .t polygon {
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .labels text {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 26px;
    fill: var(--byrne-ink);
    text-anchor: middle;
    dominant-baseline: central;
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    align-items: center;
    font-size: 0.82rem;
  }
  .ctl label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-variant-numeric: tabular-nums;
  }
  .ctl button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.8rem;
    cursor: pointer;
  }
  .read {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
</style>
