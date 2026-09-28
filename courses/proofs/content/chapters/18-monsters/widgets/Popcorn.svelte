<!--
  Thomae's function: f(p/q) = 1/q in lowest terms, f(irrational) = 0. Continuous at every
  irrational, discontinuous at every rational. Hover to see the value; the band shows how few points
  stand above height ε.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let maxQ = $state(40);
  let eps = $state(0.1);
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const pts = $derived.by(() => {
    const out: { p: number; q: number }[] = [];
    for (let q = 1; q <= maxQ; q++) for (let p = 0; p <= q; p++) if (g(p, q) === 1) out.push({ p, q });
    return out;
  });
  const above = $derived(pts.filter((t) => 1 / t.q >= eps));
  const W = 600;
  const H = 280;
  const X = (x: number) => 25 + x * (W - 40);
  const Y = (y: number) => H - 20 - y * (H - 35);
  let hover = $state<{ p: number; q: number } | null>(null);
</script>

<Widget title="Thomae’s popcorn function" subtitle="Each fraction p/q in lowest terms sits at height 1/q; irrationals are at height 0. Only finitely many points rise above any height ε — which is why the function is continuous at every irrational." onreset={() => ((maxQ = 40), (eps = 0.1))}>
  {#snippet controls()}
    <label class="ctl">denominators up to <strong>{maxQ}</strong> <input type="range" min="5" max="150" bind:value={maxQ} /></label>
    <label class="ctl">ε = <strong>{eps.toFixed(3)}</strong> <input type="range" min="0.02" max="0.5" step="0.005" bind:value={eps} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="The popcorn function on [0, 1]">
    <rect x="25" y={Y(1.02)} width={W - 40} height={Y(eps) - Y(1.02)} class="band" />
    <line x1="25" x2={W - 15} y1={Y(0)} y2={Y(0)} class="axis" />
    <line x1="25" x2={W - 15} y1={Y(eps)} y2={Y(eps)} class="eps" />
    {#each pts as t (t.p + '/' + t.q)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <circle cx={X(t.p / t.q)} cy={Y(1 / t.q)} r={t.q < 8 ? 3.5 : t.q < 30 ? 2 : 1.2} class:hi={1 / t.q >= eps} onmouseenter={() => (hover = t)} onmouseleave={() => (hover = null)} />
    {/each}
  </svg>
  <p class="read num">
    {#if hover}f({hover.p}/{hover.q}) = 1/{hover.q}{:else}{above.length} points (rationals with q ≤ {Math.floor(1 / eps)}) stand at height ≥ ε; all others are below it.{/if}
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .band {
    fill: color-mix(in srgb, var(--byrne-red) 8%, transparent);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .eps {
    stroke: var(--byrne-red);
    stroke-dasharray: 5 4;
  }
  circle {
    fill: var(--byrne-blue);
  }
  circle.hi {
    fill: var(--byrne-red);
  }
  .read {
    font-size: 0.82rem;
    text-align: center;
    margin: 0.2rem 0 0;
  }
</style>
