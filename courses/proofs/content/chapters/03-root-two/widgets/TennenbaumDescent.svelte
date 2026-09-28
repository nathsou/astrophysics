<!--
  Tennenbaum's proof that √2 is irrational. If n² = 2m², two squares of side m placed in opposite
  corners of a square of side n overlap in a square of side 2m − n and leave two squares of side
  n − m uncovered, so (2m − n)² = 2(n − m)²: a smaller solution. Zoom into the overlap and the
  picture repeats — for ever, which whole numbers cannot do.
-->
<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import Widget from '$lib/components/ui/Widget.svelte';

  let mode = $state<'real' | 'integer'>('real');
  // In 'real' mode the side is 1 and m = 1/√2 (a genuine solution in ℝ). In 'integer' mode we use
  // the best whole-number near-solutions n, m (Theon's side and diagonal numbers).
  let n = $state(1);
  let m = $state(Math.SQRT1_2);
  let depth = $state(0);
  let busy = $state(false);
  const view = new Tween({ x: 0, y: 0, s: 1 }, { duration: 1100, easing: cubicInOut });

  const PRESETS = [
    [3, 2],
    [7, 5],
    [17, 12],
    [41, 29],
    [99, 70],
  ] as const;

  function setMode(mm: 'real' | 'integer', k = 4) {
    mode = mm;
    depth = 0;
    if (mm === 'real') {
      n = 1;
      m = Math.SQRT1_2;
    } else {
      [n, m] = PRESETS[k]!;
    }
    view.set({ x: 0, y: 0, s: n }, { duration: 0 });
  }
  setMode('real');

  const overlap = $derived(2 * m - n);
  const uncovered = $derived(n - m);
  const canDescend = $derived(mode === 'real' || (overlap > 0 && uncovered > 0));

  async function descend() {
    if (busy || !canDescend) return;
    busy = true;
    // Zoom so that the overlap square [n − m, m]² fills the view (y measured from the bottom).
    await view.set({ x: n - m, y: n - m, s: overlap });
    const [n2, m2] = [2 * m - n, n - m];
    // Rescale to keep numbers tidy in real mode; integer mode keeps the true integers.
    if (mode === 'real') {
      // Exactly self-similar: (n − m)/(2m − n) = 1/√2 again. (Recomputing it in floating point would
      // amplify rounding errors about sixfold per zoom.)
      n = 1;
      m = Math.SQRT1_2;
      void m2;
      void n2;
    } else {
      n = n2;
      m = m2;
    }
    view.set({ x: 0, y: 0, s: n }, { duration: 0 });
    depth++;
    busy = false;
  }

  const W = 320;
  // Maths coordinates with y up, mapped through the current view window.
  const X = (x: number) => ((x - view.current.x) / view.current.s) * W;
  const Y = (y: number) => W - ((y - view.current.y) / view.current.s) * W;
  const rect = (x0: number, y0: number, side: number) => ({ x: X(x0), y: Y(y0 + side), w: (side / view.current.s) * W });
  const fmt = (x: number) => (mode === 'integer' ? String(Math.round(x)) : x.toFixed(4));
  const areaGap = $derived(mode === 'integer' ? n * n - 2 * m * m : 0);
</script>

<Widget title="Infinite descent in pictures" subtitle="Two squares of side m inside a square of side n. If n² = 2m², the overlap (red) equals the two uncovered corners (blue) — and it is a smaller copy of the same picture." onreset={() => setMode(mode)}>
  {#snippet controls()}
    <div class="modes">
      <button class:on={mode === 'real'} onclick={() => setMode('real')}>Real numbers: m = n/√2</button>
      <button class:on={mode === 'integer'} onclick={() => setMode('integer')}>Whole numbers</button>
    </div>
    {#if mode === 'integer'}
      <label class="ctl">start
        <select onchange={(e) => setMode('integer', Number((e.target as HTMLSelectElement).value))}>
          {#each PRESETS as p, i (i)}<option value={i} selected={i === 4}>n = {p[0]}, m = {p[1]}</option>{/each}
        </select>
      </label>
    {/if}
    <button class="go" onclick={descend} disabled={busy || !canDescend}>Zoom into the overlap ↘</button>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {W} {W}" width="100%" style:max-width="{W}px" role="img" aria-label="A square of side n with two squares of side m in opposite corners">
      <defs>
        <clipPath id="tb-clip"><rect x="0" y="0" width={W} height={W} /></clipPath>
      </defs>
      <g clip-path="url(#tb-clip)">
        {#each [rect(0, 0, n)] as r (0)}<rect x={r.x} y={r.y} width={r.w} height={r.w} class="big" />{/each}
        {#each [rect(0, n - uncovered, uncovered), rect(n - uncovered, 0, uncovered)] as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.w} class="unc" />{/each}
        {#each [rect(0, 0, m), rect(n - m, n - m, m)] as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.w} class="mid" />{/each}
        {#each [rect(n - m, n - m, overlap)] as r (0)}<rect x={r.x} y={r.y} width={r.w} height={r.w} class="ov" />{/each}
      </g>
    </svg>
    <div class="info ui num">
      <p><span class="sw big-sw"></span> side n = <strong>{fmt(n)}</strong></p>
      <p><span class="sw mid-sw"></span> sides m = <strong>{fmt(m)}</strong></p>
      <p><span class="sw ov-sw"></span> overlap side 2m − n = <strong>{fmt(overlap)}</strong></p>
      <p><span class="sw unc-sw"></span> corners side n − m = <strong>{fmt(uncovered)}</strong></p>
      <p class="depth">Zoom level: {depth}</p>
      {#if mode === 'integer'}
        <p class="gap">n² − 2m² = <strong>{areaGap}</strong> — {areaGap === 0 ? 'an exact solution' : 'close, but not a solution'}</p>
        {#if !canDescend}<p class="gap">The descent stops: the numbers can’t get any smaller.</p>{/if}
      {:else}
        <p class="gap">The picture after each zoom is identical: the descent never ends. With whole numbers it would have to.</p>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .modes {
    display: flex;
    gap: 0.25rem;
  }
  .modes button,
  .go {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.7rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .modes button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .go {
    border-color: var(--accent);
  }
  .go:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
  }
  .ctl select {
    font: inherit;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: center;
    justify-content: center;
  }
  rect {
    stroke: var(--byrne-ink);
    stroke-width: 1.2;
  }
  .big {
    fill: var(--surface);
  }
  .mid {
    fill: color-mix(in srgb, var(--byrne-yellow) 55%, transparent);
  }
  .ov {
    fill: var(--byrne-red);
    fill-opacity: 0.85;
  }
  .unc {
    fill: var(--byrne-blue);
    fill-opacity: 0.8;
  }
  .info {
    font-size: 0.85rem;
    max-width: 17rem;
  }
  .info p {
    margin: 0.2rem 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .sw {
    width: 0.9rem;
    height: 0.9rem;
    border: 1px solid var(--byrne-ink);
    border-radius: 2px;
  }
  .big-sw {
    background: var(--surface);
  }
  .mid-sw {
    background: color-mix(in srgb, var(--byrne-yellow) 55%, transparent);
  }
  .ov-sw {
    background: var(--byrne-red);
  }
  .unc-sw {
    background: var(--byrne-blue);
  }
  .depth {
    color: var(--ink-3);
  }
  .gap {
    color: var(--ink-2);
    font-size: 0.8rem;
  }
</style>
