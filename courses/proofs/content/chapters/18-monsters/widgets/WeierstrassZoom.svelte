<!--
  Weierstrass's function W(x) = Σ aⁿ cos(bⁿπx) with a = 1/2, b = 13 (so ab > 1 + 3π/2): continuous
  everywhere, differentiable nowhere. Zoom in as far as you like; it never straightens out.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const A = 0.5;
  const B = 13;
  let logZoom = $state(0);
  let centre = $state(0.3);
  const zoom = $derived(10 ** logZoom);
  const half = $derived(0.5 / zoom);
  const lo = $derived(centre - half);
  const hi = $derived(centre + half);
  const W = 600;
  const H = 280;
  const N = 1200;

  /** Enough terms that the neglected tail is invisible at this scale. */
  const terms = $derived(Math.min(14, Math.ceil(Math.log(N * zoom * 4) / Math.log(B)) + 3));
  const w = (x: number) => {
    let s = 0;
    let an = 1;
    let bn = 1;
    for (let k = 0; k < terms; k++) {
      s += an * Math.cos(bn * Math.PI * x);
      an *= A;
      bn *= B;
    }
    return s;
  };
  const ys = $derived(Array.from({ length: N + 1 }, (_, i) => w(lo + ((hi - lo) * i) / N)));
  const yr = $derived.by(() => {
    const mn = Math.min(...ys);
    const mx = Math.max(...ys);
    const pad = (mx - mn) * 0.08 || 0.1;
    return [mn - pad, mx + pad] as const;
  });
  const path = $derived(ys.map((y, i) => `${i ? 'L' : 'M'}${((i / N) * (W - 20) + 10).toFixed(1)},${(10 + ((yr[1] - y) / (yr[1] - yr[0])) * (H - 20)).toFixed(1)}`).join(''));

  function click(e: MouseEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    centre = lo + fx * (hi - lo);
    logZoom = Math.min(7, logZoom + 0.5);
  }
</script>

<Widget title="Zooming into a monster" subtitle="W(x) = Σ (½)ⁿ cos(13ⁿ π x). Click anywhere on the graph to zoom in there (or use the slider). A differentiable function would look like a straight line at high zoom. This one never does." onreset={() => ((logZoom = 0), (centre = 0.3))}>
  {#snippet controls()}
    <label class="ctl">zoom ×<strong class="num">{zoom < 1000 ? zoom.toFixed(1) : zoom.toExponential(1)}</strong> <input type="range" min="0" max="7" step="0.1" bind:value={logZoom} /></label>
    <span class="read num">window [{lo.toPrecision(10)}, {hi.toPrecision(10)}] · {terms} terms</span>
  {/snippet}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <svg viewBox="0 0 {W} {H}" width="100%" onclick={click} role="img" aria-label="Graph of the Weierstrass function near {centre.toFixed(6)}">
    <path d={path} class="graph" />
  </svg>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .read {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  svg {
    cursor: zoom-in;
  }
  .graph {
    fill: none;
    stroke: var(--byrne-blue);
    stroke-width: 1;
  }
</style>
