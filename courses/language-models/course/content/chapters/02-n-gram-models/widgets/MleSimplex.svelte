<!--
  The log-likelihood ℓ(p) = Σ cᵢ log pᵢ over the probability simplex for three outcomes.
  Every point of the triangle is a distribution (p_a, p_b, p_c); the brightest point is the MLE,
  which is always the relative frequency cᵢ/N.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { colormapLUT, colorAt } from '$lib/gfx/colormap';
  import { theme } from '$lib/state/theme.svelte';
  import { focus } from '$lib/state/params.svelte';

  let counts = $state([6, 3, 1]);
  const labels = ['a', 'b', 'c'];
  let canvas: HTMLCanvasElement;
  let guess = $state<[number, number, number] | null>(null);
  let hover = $state<[number, number, number] | null>(null);

  const S = 300; // canvas size (CSS px)
  const pad = 22;
  // Triangle vertices: a (top), b (bottom-left), c (bottom-right).
  const A = { x: S / 2, y: pad }, B = { x: pad, y: S - pad }, C = { x: S - pad, y: S - pad };

  const N = $derived(counts.reduce((x, y) => x + y, 0));
  const mle = $derived(N > 0 ? (counts.map((c) => c / N) as [number, number, number]) : ([1 / 3, 1 / 3, 1 / 3] as [number, number, number]));
  const ll = (p: number[]) => counts.reduce((s, c, i) => s + (c > 0 ? c * Math.log(p[i]!) : 0), 0);

  function toXY(p: number[]) {
    return { x: p[0]! * A.x + p[1]! * B.x + p[2]! * C.x, y: p[0]! * A.y + p[1]! * B.y + p[2]! * C.y };
  }
  function toBary(x: number, y: number): [number, number, number] | null {
    const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    const a = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / det;
    const b = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / det;
    const c = 1 - a - b;
    return a < 0 || b < 0 || c < 0 ? null : [a, b, c];
  }

  function draw() {
    if (!canvas) return;
    const dpr = devicePixelRatio || 1;
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(canvas.width, canvas.height);
    const lut = colormapLUT('sequential', theme.resolved);
    const best = ll(mle);
    // Colour by ℓ relative to its maximum; clamp the (−∞) boundary to a floor.
    const floor = best - Math.max(4, N * 1.2);
    for (let py = 0; py < canvas.height; py++) {
      for (let px = 0; px < canvas.width; px++) {
        const p = toBary(px / dpr, py / dpr);
        if (!p) continue;
        const v = ll(p.map((x) => Math.max(x, 1e-9)));
        const t = Math.max(0, Math.min(1, (v - floor) / (best - floor)));
        // Quantise into bands so level sets (contours) are visible.
        const band = Math.floor(t * 12) / 12;
        const li = Math.round(band * 255) * 4;
        const o = (py * canvas.width + px) * 4;
        img.data[o] = lut[li]!;
        img.data[o + 1] = lut[li + 1]!;
        img.data[o + 2] = lut[li + 2]!;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  onMount(draw);
  $effect(() => {
    void counts[0], counts[1], counts[2], theme.resolved;
    draw();
  });

  const mlePos = $derived(toXY(mle));
  const fmt = (p: number[]) => `(${p.map((x) => x.toFixed(2)).join(', ')})`;
  const shown = $derived(hover ?? guess);
</script>

<Widget
  title="Why counting is optimal: the likelihood surface"
  subtitle="Every point in the triangle is a distribution over three outcomes. Colour is the log-likelihood of the observed counts, in bands like contour lines. The maximum always sits at the relative frequencies."
  onreset={() => {
    counts = [6, 3, 1];
    guess = null;
  }}
>
  {#snippet controls()}
    {#each labels as l, i (l)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="ctl" onpointerenter={() => focus.set('chw', 'mle')} onpointerleave={() => focus.set(null)}>
        <Slider label="count of {l}" min={0} max={30} step={1} value={counts[i]!} oninput={(v) => (counts[i] = v)} format={(v) => String(v)} />
      </div>
    {/each}
  {/snippet}

  <div class="layout">
    <div class="tri">
      <canvas
        bind:this={canvas}
        style:width="{S}px"
        style:height="{S}px"
        aria-label="Log-likelihood over the probability simplex"
        onpointermove={(e) => {
          const r = canvas.getBoundingClientRect();
          hover = toBary(e.clientX - r.left, e.clientY - r.top);
        }}
        onpointerleave={() => (hover = null)}
        onclick={() => (guess = hover)}
      ></canvas>
      <svg class="overlay" width={S} height={S} aria-hidden="true">
        <polygon points="{A.x},{A.y} {B.x},{B.y} {C.x},{C.y}" class="edge" />
        <text x={A.x} y={A.y - 6} text-anchor="middle">p_a = 1</text>
        <text x={B.x - 4} y={B.y + 16} text-anchor="start">p_b = 1</text>
        <text x={C.x + 4} y={C.y + 16} text-anchor="end">p_c = 1</text>
        {#if guess}
          {@const g = toXY(guess)}
          <circle cx={g.x} cy={g.y} r="6" class="guess" />
        {/if}
        <circle cx={mlePos.x} cy={mlePos.y} r="6" class="mle" />
      </svg>
    </div>
    <div class="side">
      <dl>
        <dt>Counts</dt>
        <dd class="num">c = ({counts.join(', ')}), N = {N}</dd>
        <dt><span class="sw mle-sw"></span>Maximum-likelihood estimate</dt>
        <dd class="num">p̂ = c / N = {fmt(mle)}</dd>
        <dd class="num">ℓ(p̂) = {ll(mle).toFixed(3)} nats</dd>
        {#if shown}
          <dt><span class="sw guess-sw"></span>{hover ? 'Under the pointer' : 'Your guess (click to place)'}</dt>
          <dd class="num">p = {fmt(shown)}</dd>
          <dd class="num">ℓ(p) = {ll(shown.map((x) => Math.max(x, 1e-12))).toFixed(3)} nats — {(ll(mle) - ll(shown.map((x) => Math.max(x, 1e-12)))).toFixed(3)} worse</dd>
        {:else}
          <dt>Try it</dt>
          <dd class="prose">Hover the triangle to compare any distribution with the MLE; click to pin a guess.</dd>
        {/if}
      </dl>
      <div class="scale">
        <span>lower ℓ</span>
        <span class="ramp" style:background="linear-gradient(to right, {[0, 0.25, 0.5, 0.75, 1].map((t) => colorAt('sequential', theme.resolved, t)).join(',')})"></span>
        <span>higher ℓ</span>
      </div>
      <p class="note">Set a count to 0 and the maximum moves onto an edge of the triangle: the MLE gives that outcome probability exactly 0. That is the problem smoothing solves.</p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    flex: 1 1 9rem;
  }
  .layout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .tri {
    position: relative;
    width: 300px;
    height: 300px;
  }
  canvas {
    display: block;
    cursor: crosshair;
  }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }
  .edge {
    fill: none;
    stroke: var(--rule-strong);
  }
  .overlay text {
    font-size: 11px;
    fill: var(--ink-2);
    font-family: var(--font-mono);
  }
  .mle {
    fill: var(--series-2);
    stroke: var(--chart-surface);
    stroke-width: 2;
  }
  .guess {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }
  dl {
    margin: 0;
    font-size: 0.85rem;
  }
  dt {
    margin-top: 0.6rem;
    font-size: 0.74rem;
    color: var(--ink-2);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  dd {
    margin: 0.1rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .sw {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .mle-sw {
    background: var(--series-2);
  }
  .guess-sw {
    border: 2px solid var(--ink);
  }
  dd.prose {
    font-family: var(--font-ui);
  }
  .scale {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1rem;
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .ramp {
    width: 100px;
    height: 8px;
    border-radius: 4px;
  }
  .note {
    margin-top: 1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
