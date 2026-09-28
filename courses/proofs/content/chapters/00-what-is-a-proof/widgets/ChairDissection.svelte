<!--
  A dissection proof of Pythagoras' theorem: cut the "chair" made of the squares on the legs
  (b² and a²) along two lines of length c, then rotate two triangles by a quarter turn about their
  corners. They fill the square on the hypotenuse exactly.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let a = $state(2.2);
  let b = $state(3.6);
  let turned = $state(false);
  let playing = $state(false);

  const W = 380;
  const lo = $derived(Math.min(a, b));
  const hi = $derived(Math.max(a, b));
  // Scale so the whole figure (width lo + hi, height lo + hi when turned) fits.
  const s = $derived((W - 20) / (lo + hi));
  // Maths coordinates (y up) → SVG (y down).
  const X = (x: number) => 10 + x * s;
  const Y = (y: number) => W - 10 - y * s;
  const pt = (x: number, y: number) => `${X(x)},${Y(y)}`;

  // Chair: big square [0,hi]², small square [hi, hi+lo]×[0, lo]. Cuts from P = (lo, 0).
  const pentagon = $derived([pt(lo, 0), pt(hi + lo, lo), pt(hi, lo), pt(hi, hi), pt(0, hi)].join(' '));
  const t1 = $derived([pt(0, 0), pt(lo, 0), pt(0, hi)].join(' '));
  const t2 = $derived([pt(lo, 0), pt(hi + lo, 0), pt(hi + lo, lo)].join(' '));
  const square = $derived([pt(lo, 0), pt(hi + lo, lo), pt(hi, hi + lo), pt(0, hi)].join(' '));

  function toggle() {
    turned = !turned;
  }

  $effect(() => {
    if (!playing) return;
    const id = setInterval(toggle, 2400);
    return () => clearInterval(id);
  });
</script>

<Widget title="Two squares become one" subtitle="The squares on the legs, cut twice and rearranged by two quarter turns. Change the triangle; the pieces always fit." onreset={() => ((a = 2.2), (b = 3.6), (turned = false))}>
  {#snippet controls()}
    <label class="ctl">a <input type="range" min="0.8" max="4" step="0.05" bind:value={a} aria-label="Leg a" /></label>
    <label class="ctl">b <input type="range" min="0.8" max="4" step="0.05" bind:value={b} aria-label="Leg b" /></label>
    <button class="btn" onclick={toggle}>{turned ? 'Back to a² + b²' : 'Turn the triangles'}</button>
    <label class="ctl"><input type="checkbox" bind:checked={playing} /> loop</label>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {W} {W}" width="100%" style:max-width="{W}px" role="img" aria-label={turned ? 'The pieces form the square on the hypotenuse' : 'The pieces form the squares on the two legs'}>
      <polygon points={square} class="target" class:show={turned} />
      <polygon points={pentagon} class="piece p0" />
      <polygon points={t1} class="piece p1" style:transform-origin="{X(0)}px {Y(hi)}px" style:transform={turned ? 'rotate(-90deg)' : 'none'} />
      <polygon points={t2} class="piece p2" style:transform-origin="{X(hi + lo)}px {Y(lo)}px" style:transform={turned ? 'rotate(90deg)' : 'none'} />
      {#if !turned}
        <text x={X(hi / 2)} y={Y(hi / 2 + hi / 6)}>{a <= b ? 'b²' : 'a²'}</text>
        <text x={X(hi + lo / 2)} y={Y(lo / 2)} class="small">{a <= b ? 'a²' : 'b²'}</text>
      {:else}
        <text x={X((lo + hi) / 2)} y={Y((hi + lo) / 2)}>c²</text>
      {/if}
      <circle cx={X(0)} cy={Y(hi)} r="4" class="pivot" />
      <circle cx={X(hi + lo)} cy={Y(lo)} r="4" class="pivot" />
    </svg>
    <p class="read ui num">a² + b² = {(a * a).toFixed(2)} + {(b * b).toFixed(2)} = {(a * a + b * b).toFixed(2)} &nbsp;·&nbsp; c² = {(a * a + b * b).toFixed(2)}</p>
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
  .btn {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.8rem;
    cursor: pointer;
    font-size: 0.82rem;
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
    transform-box: view-box;
    transition: transform 1s cubic-bezier(0.65, 0, 0.35, 1);
  }
  .p0 {
    fill: color-mix(in srgb, var(--byrne-blue) 55%, var(--surface));
  }
  .p1 {
    fill: var(--byrne-red);
  }
  .p2 {
    fill: var(--byrne-yellow);
  }
  .target {
    fill: none;
    stroke: var(--byrne-ink);
    stroke-dasharray: 5 4;
    opacity: 0;
    transition: opacity 0.4s 0.8s;
  }
  .target.show {
    opacity: 0.8;
  }
  .pivot {
    fill: var(--surface);
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
  }
  text {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 24px;
    fill: var(--byrne-ink);
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  text.small {
    font-size: 18px;
  }
  .read {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
</style>
