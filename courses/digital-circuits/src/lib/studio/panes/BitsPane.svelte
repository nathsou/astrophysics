<!--
  The bits view: the fuse map or configuration bits as a grid of cells on a canvas (thousands of bits stay
  cheap). Lit cells are configured bits and glow metal; the selection is green, the hover copper.
  Hover a bit for what it controls; click to select its term or output; arrow keys move a cursor.
-->
<script lang="ts">
  import '../chips/chip.css';
  import { onMount } from 'svelte';
  import type { Studio } from '../studio.svelte';
  import { mix, onThemeChange, readSignals, type Signals } from '../../theme/signals';

  let { studio }: { studio: Studio } = $props();

  const bits = $derived(studio.fit?.bits);
  let wrap: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(400);
  let hoverIndex = $state(-1);
  let cursor = $state({ row: 0, col: 0 });
  let focused = $state(false);
  let tip = $state<{ x: number; y: number; text: string } | null>(null);
  let sig: Signals | undefined;
  let themeTick = $state(0);

  const LABEL = 46;
  const TOP = 6;
  const GAP = 6;

  const metrics = $derived.by(() => {
    if (!bits) return { cell: 8, tops: [] as number[], height: 20, labels: false };
    const labels = width > 220;
    const avail = width - (labels ? LABEL : 6) - 8;
    const cell = Math.max(3, Math.min(16, Math.floor(avail / bits.columns)));
    const gaps = new Set(bits.gapsAfter ?? []);
    const tops: number[] = [];
    let y = TOP;
    for (let r = 0; r < bits.rows; r++) {
      tops.push(y);
      y += cell + (gaps.has(r) ? GAP : 0);
    }
    return { cell, tops, height: y + 6, labels };
  });

  function rowAt(y: number): number {
    const { tops, cell } = metrics;
    let lo = 0;
    let hi = tops.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (tops[mid]! <= y) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans >= 0 && y < tops[ans]! + cell ? ans : -1;
  }
  const xLeft = $derived(metrics.labels ? LABEL : 6);
  function indexAt(x: number, y: number): { i: number; row: number; col: number } | null {
    if (!bits) return null;
    const col = Math.floor((x - xLeft) / metrics.cell);
    const row = rowAt(y);
    if (row < 0 || col < 0 || col >= bits.columns) return null;
    const i = bits.index(row, col);
    return i >= 0 ? { i, row, col } : null;
  }

  function draw() {
    const c = canvas;
    const b = bits;
    if (!c || !b) return;
    sig ??= readSignals(c);
    const dpr = window.devicePixelRatio || 1;
    const { cell, tops, height, labels } = metrics;
    c.width = Math.floor(width * dpr);
    c.height = Math.floor(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const metal = sig.siliconMetal;
    const tones = [mix(sig.siliconMetal, sig.silicon, 0.86), mix(sig.siliconMetal, sig.silicon, 0.8), mix(sig.phosphor, sig.silicon, 0.84), mix(sig.copper, sig.silicon, 0.84), mix(sig.current, sig.silicon, 0.84), mix(sig.mute, sig.silicon, 0.86)];
    const size = Math.max(2, cell - (cell >= 6 ? 2 : 1));
    if (labels && cell >= 7) {
      ctx.font = `${Math.min(10, cell)}px ${getComputedStyle(c).getPropertyValue('--font-mono') || 'monospace'}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillStyle = sig.mute;
      for (let r = 0; r < b.rows; r++) ctx.fillText(b.rowLabel(r), LABEL - 5, tops[r]! + cell / 2);
    }
    for (let r = 0; r < b.rows; r++) {
      const y = tops[r]!;
      for (let col = 0; col < b.columns; col++) {
        const i = b.index(r, col);
        if (i < 0) continue;
        const x = xLeft + col * cell;
        if (b.lit(i)) {
          ctx.fillStyle = metal;
          ctx.fillRect(x + 1, y + 1, size, size);
        } else {
          ctx.fillStyle = tones[b.region(i)] ?? tones[0]!;
          ctx.fillRect(x + 1, y + 1, size, size);
        }
      }
    }
    // Selection, hover, cursor.
    const ring = (i: number, colour: string, lw: number, fill?: string) => {
      const { row, col } = b.cell(i);
      const x = xLeft + col * cell;
      const y = tops[row]!;
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cell, cell);
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = lw;
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    };
    for (const i of studio.hoverProbe.bits) ring(i, sig.copper, 1, mix(sig.copper, 'rgba(0,0,0,0)', 0.35));
    for (const i of studio.probe.bits) ring(i, sig.phosphor, 1.3, mix(sig.phosphor, 'rgba(0,0,0,0)', 0.4));
    if (hoverIndex >= 0) ring(hoverIndex, '#ffffff', 1.5);
    if (focused) {
      const i = b.index(cursor.row, cursor.col);
      if (i >= 0) ring(i, sig.current, 2);
    }
  }

  $effect(() => {
    void [bits, width, metrics, studio.probe, studio.hoverProbe, hoverIndex, cursor, focused, themeTick, studio.fit];
    draw();
  });

  onMount(() => {
    const ro = new ResizeObserver(() => {
      if (wrap && wrap.clientWidth > 4) width = wrap.clientWidth;
    });
    if (wrap) ro.observe(wrap);
    const off = onThemeChange(() => {
      sig = undefined;
      themeTick++;
    });
    return () => {
      ro.disconnect();
      off();
    };
  });

  function pos(ev: PointerEvent) {
    const r = canvas!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, ox: ev.clientX - wrap!.getBoundingClientRect().left + wrap!.scrollLeft, oy: ev.clientY - wrap!.getBoundingClientRect().top + wrap!.scrollTop };
  }
  function move(ev: PointerEvent) {
    const p = pos(ev);
    const hit = indexAt(p.x, p.y);
    hoverIndex = hit ? hit.i : -1;
    if (hit && bits) {
      tip = { x: Math.min(p.ox + 12, width - 260), y: p.oy + 16, text: bits.describe(hit.i) };
      studio.hover({ kind: 'bit', index: hit.i });
    } else {
      tip = null;
      studio.hover(null);
    }
  }
  function leave() {
    hoverIndex = -1;
    tip = null;
    studio.hover(null);
  }
  function click(ev: MouseEvent) {
    const r = canvas!.getBoundingClientRect();
    const hit = indexAt(ev.clientX - r.left, ev.clientY - r.top);
    if (hit) studio.select({ kind: 'bit', index: hit.i });
  }
  function key(ev: KeyboardEvent) {
    if (!bits) return;
    let { row, col } = cursor;
    if (ev.key === 'ArrowLeft') col--;
    else if (ev.key === 'ArrowRight') col++;
    else if (ev.key === 'ArrowUp') row--;
    else if (ev.key === 'ArrowDown') row++;
    else if (ev.key === 'PageDown') row += 10;
    else if (ev.key === 'PageUp') row -= 10;
    else if (ev.key === 'Home') col = 0;
    else if (ev.key === 'End') col = bits.columns - 1;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      const i = bits.index(cursor.row, cursor.col);
      if (i >= 0) studio.select({ kind: 'bit', index: i });
      ev.preventDefault();
      return;
    } else return;
    ev.preventDefault();
    row = Math.max(0, Math.min(bits.rows - 1, row));
    col = Math.max(0, Math.min(bits.columns - 1, col));
    if (bits.index(row, col) < 0) return;
    cursor = { row, col };
    const i = bits.index(row, col);
    studio.hover({ kind: 'bit', index: i });
    const y = metrics.tops[row]!;
    if (wrap && (y < wrap.scrollTop + 20 || y > wrap.scrollTop + wrap.clientHeight - 30)) wrap.scrollTop = Math.max(0, y - wrap.clientHeight / 2);
  }
  const live = $derived(bits && focused ? bits.describe(bits.index(cursor.row, cursor.col)) : '');
  const lit = $derived(bits ? bits.litMeaning : '');
</script>

<div class="bits">
  {#if bits}
    <div class="legend ui">
      <strong>{bits.title}</strong>
      <span class="sw lit"></span>{lit}
      <span class="sw dim"></span>{bits.unlitMeaning}
      <span class="n">{bits.count} bits</span>
    </div>
  {/if}
  <div class="die screen wrap" bind:this={wrap}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_interactive_element_to_noninteractive_role -->
    <canvas
      bind:this={canvas}
      tabindex="0"
      role="application"
      aria-label="{bits?.title ?? 'Bits'}: {bits?.rows ?? 0} rows of {bits?.columns ?? 0} bits. Arrow keys move; Enter selects."
      onpointermove={move}
      onpointerleave={leave}
      onclick={click}
      onkeydown={key}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
    ></canvas>
    {#if tip}<div class="tip" style:left="{tip.x}px" style:top="{tip.y}px" role="tooltip">{tip.text}</div>{/if}
    <p class="sr" aria-live="polite">{live}</p>
  </div>
</div>

<style>
  .bits {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.74rem;
    color: var(--ink-2);
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    flex-wrap: wrap;
  }
  .sw {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-left: 0.4rem;
  }
  .sw.lit {
    background: var(--silicon-metal);
  }
  .sw.dim {
    background: color-mix(in srgb, var(--silicon-metal) 16%, var(--silicon));
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .n {
    margin-left: auto;
    font-family: var(--font-mono);
    color: var(--mute);
  }
  .wrap {
    flex: 1;
    min-height: 8rem;
    overflow: auto;
    border-radius: 0;
  }
  canvas {
    display: block;
    cursor: crosshair;
  }
  canvas:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    margin: 0;
  }
</style>
