<!--
  The FPGA bits view: the configuration frames as a grid, one row per frame (a tile column). Overview mode
  squeezes each frame into the pane's width, colouring every cell by what most of its bits are and by how many are
  set; bit mode draws every bit, scrolling sideways. Hover a bit for what it controls (`describeBit`); click to
  select it. What is selected elsewhere (a line, a module, a net, a cell) marks its bits here.
-->
<script lang="ts">
  import '../../chips/chip.css';
  import { onMount } from 'svelte';
  import { describeBit } from '../../../pld/devices/vfpga-config';
  import { mix, onThemeChange, readSignals, withAlpha, type Signals } from '../../../theme/signals';
  import { CATEGORY_LABEL, bitIndex, bitPosition, countSet, frameSegments, segmentAt, type BitCategory } from '../../fpga/bitlayout';
  import type { FpgaSession } from '../../fpga/session.svelte';

  let { session }: { session: FpgaSession } = $props();

  const device = $derived(session.mode === 'hand' ? session.hand.device : session.device);
  const bits = $derived(session.mode === 'hand' ? session.hand.bits : (session.result?.bits ?? null));
  let mode = $state<'overview' | 'bits'>('overview');
  let wrap: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(400);
  let scrollLeft = $state(0);
  let hover = $state<{ index: number; from: number; to: number } | null>(null);
  let tip = $state<{ x: number; y: number; text: string; sub: string } | null>(null);
  let sig: Signals | undefined;
  let themeTick = $state(0);
  let raf = 0;

  const LABEL = 30;
  const ROW = 15;
  const GAP = 3;
  const CELL = 7;

  const frames = $derived(device?.frames ?? []);
  const maxLen = $derived(Math.max(1, ...frames.map((f) => f.length)));
  const viewW = $derived(Math.max(60, width - LABEL - 4));
  /** Bits per grid cell in the overview, and the width of the whole grid. */
  const per = $derived(mode === 'overview' ? Math.max(1, Math.ceil(maxLen / Math.floor(viewW / 3))) : 1);
  const cell = $derived(mode === 'overview' ? Math.max(1, Math.floor(viewW / Math.ceil(maxLen / per))) : CELL);
  const cols = $derived(Math.ceil(maxLen / per));
  const gridW = $derived(cols * cell);
  const height = $derived(frames.length * (ROW + GAP) + 8);

  const tone = (c: BitCategory | undefined, s: Signals): string => {
    switch (c) {
      case 'lut':
        return s.high;
      case 'flag':
        return s.copper;
      case 'clock':
        return s.current;
      case 'pad':
        return s.phosphor;
      case 'ram':
      case 'ram-init':
        return s.voltNeg;
      default:
        return s.siliconMetal;
    }
  };

  function draw() {
    raf = 0;
    const c = canvas;
    const dev = device;
    const b = bits;
    if (!c || !dev || !b) return;
    sig ??= readSignals(c);
    const s = sig;
    const dpr = window.devicePixelRatio || 1;
    const w = mode === 'overview' ? width : width;
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(height * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    ctx.font = `10px ${getComputedStyle(c).getPropertyValue('--font-mono') || 'monospace'}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const first = mode === 'bits' ? Math.floor(scrollLeft / cell) : 0;
    const last = mode === 'bits' ? Math.min(cols, Math.ceil((scrollLeft + viewW) / cell) + 1) : cols;
    const sel = session.probe.bits;
    const hov = session.hoverProbe.bits;
    const base = mix(s.silicon, '#000', 0.2);
    frames.forEach((fr, f) => {
      const y = 4 + f * (ROW + GAP);
      ctx.fillStyle = s.mute;
      ctx.fillText(`F${f}`, LABEL - 5, y + ROW / 2);
      const segs = frameSegments(dev, f);
      let si = 0;
      const nCols = Math.ceil(fr.length / per);
      for (let col = first; col < Math.min(last, nCols); col++) {
        const from = fr.start + col * per;
        const to = Math.min(fr.start + fr.length, from + per);
        while (si < segs.length - 1 && segs[si]!.end <= from) si++;
        const seg = segs[si]!;
        const n = countSet(b, from, to);
        const x = LABEL + col * cell - (mode === 'bits' ? scrollLeft : 0);
        const frac = n / (to - from);
        ctx.fillStyle = n ? mix(base, tone(seg.cat, s), 0.35 + 0.65 * (mode === 'bits' ? 1 : Math.min(1, frac * 2))) : mix(base, tone(seg.cat, s), 0.14);
        const inset = cell >= 5 ? 1 : 0;
        ctx.fillRect(x + inset, y + (mode === 'bits' ? 1 : 0), Math.max(1, cell - inset), mode === 'bits' ? ROW - 2 : ROW);
        if (mode === 'bits' && cell >= 7) {
          ctx.fillStyle = n ? '#1b1204' : withAlpha(s.mute, 0.5);
          ctx.textAlign = 'center';
          ctx.fillText(n ? '1' : '0', x + cell / 2, y + ROW / 2);
          ctx.textAlign = 'right';
        }
        const inRange = (set: ReadonlySet<number>) => {
          if (per === 1) return set.has(from);
          for (const i of set) if (i >= from && i < to) return true;
          return false;
        };
        if (sel.size && inRange(sel)) {
          ctx.strokeStyle = s.phosphor;
          ctx.lineWidth = 1.6;
          ctx.strokeRect(x + 0.5, y + 0.5, Math.max(2, cell - 1), ROW - 1);
        } else if (hov.size && inRange(hov)) {
          ctx.strokeStyle = s.copper;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x + 0.5, y + 0.5, Math.max(2, cell - 1), ROW - 1);
        }
        if (hover && hover.from === from) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.5, y + 0.5, Math.max(2, cell - 1), ROW - 1);
        }
      }
    });
  }
  $effect(() => {
    void [device, bits, mode, width, scrollLeft, session.probe, session.hoverProbe, hover, themeTick, cell, per, session.hand.tick];
    if (!raf) raf = requestAnimationFrame(draw);
  });

  onMount(() => {
    const ro = new ResizeObserver(() => wrap && wrap.clientWidth > 4 && (width = wrap.clientWidth));
    if (wrap) ro.observe(wrap);
    const off = onThemeChange(() => {
      sig = undefined;
      themeTick++;
    });
    return () => {
      ro.disconnect();
      off();
      cancelAnimationFrame(raf);
    };
  });

  function at(ev: PointerEvent | MouseEvent): { f: number; col: number } | null {
    const r = canvas!.getBoundingClientRect();
    const x = ev.clientX - r.left - LABEL + (mode === 'bits' ? scrollLeft : 0);
    const y = ev.clientY - r.top - 4;
    const f = Math.floor(y / (ROW + GAP));
    const col = Math.floor(x / cell);
    if (f < 0 || f >= frames.length || col < 0 || y - f * (ROW + GAP) > ROW) return null;
    return { f, col };
  }
  function move(ev: PointerEvent) {
    const p = at(ev);
    const dev = device;
    const b = bits;
    if (!p || !dev || !b || p.col * per >= frames[p.f]!.length) {
      hover = null;
      tip = null;
      session.hover(null);
      return;
    }
    const from = frames[p.f]!.start + p.col * per;
    const to = Math.min(frames[p.f]!.start + frames[p.f]!.length, from + per);
    // A cell of several bits stands for its first set bit (or its first bit).
    let index = from;
    for (let i = from; i < to; i++) if (b[i]) {
      index = i;
      break;
    }
    hover = { index, from, to };
    const r = wrap!.getBoundingClientRect();
    const d = describeBit(dev, index, b);
    tip = { x: Math.min(ev.clientX - r.left + 12, width - 250), y: ev.clientY - r.top + 16, text: d.text, sub: per > 1 ? `bits ${from}–${to - 1}: ${countSet(b, from, to)} set` : `bit ${index} in frame ${p.f}` };
    session.hover({ kind: 'bit', index });
  }
  function leave() {
    hover = null;
    tip = null;
    session.hover(null);
  }
  function click(ev: MouseEvent) {
    if (hover) session.select({ kind: 'bit', index: hover.index });
    void ev;
  }

  // Bring the selection into view in bit mode.
  $effect(() => {
    const dev = device;
    const first = [...session.probe.bits][0];
    if (mode !== 'bits' || !dev || first === undefined || !wrap) return;
    const { offset } = bitPosition(dev, first);
    const x = offset * cell;
    if (x < scrollLeft || x > scrollLeft + viewW - 40) wrap.scrollLeft = Math.max(0, x - viewW / 2);
  });

  // Keyboard: arrows move the selected bit.
  function key(ev: KeyboardEvent) {
    const dev = device;
    if (!dev) return;
    const cur = session.selected?.kind === 'bit' ? session.selected.index : (hover?.index ?? 0);
    const { frame, offset } = bitPosition(dev, cur);
    let f = frame;
    let o = offset;
    if (ev.key === 'ArrowRight') o++;
    else if (ev.key === 'ArrowLeft') o--;
    else if (ev.key === 'ArrowDown') f++;
    else if (ev.key === 'ArrowUp') f--;
    else if (ev.key === 'PageDown') o += 25;
    else if (ev.key === 'PageUp') o -= 25;
    else return;
    ev.preventDefault();
    f = Math.max(0, Math.min(dev.frames.length - 1, f));
    o = Math.max(0, Math.min(dev.frames[f]!.length - 1, o));
    session.selected = { kind: 'bit', index: bitIndex(dev, f, o) };
  }

  const legend = $derived(device ? (['lut', 'flag', 'clock', 'pad', 'mux'] as BitCategory[]).concat(device.spec.bramCols.length ? ['ram-init'] : []) : []);
  const set = $derived(bits ? countSet(bits, 0, bits.length) : 0);
  const live = $derived(device && session.selected?.kind === 'bit' && bits ? describeBit(device, session.selected.index, bits).text : '');
</script>

<div class="bits">
  {#if device && bits}
    <div class="legend ui">
      <strong>{device.name}</strong>
      <span>{device.totalBits.toLocaleString('en-GB')} bits, {set.toLocaleString('en-GB')} set, {frames.length} frames</span>
      <span class="grow"></span>
      <div class="seg" role="group" aria-label="Bits view mode">
        <button type="button" class:on={mode === 'overview'} onclick={() => (mode = 'overview')} title="Each frame squeezed into the width of the pane">Overview</button>
        <button type="button" class:on={mode === 'bits'} onclick={() => (mode = 'bits')} title="Every bit, scrolling sideways">Bits</button>
      </div>
    </div>
    <div class="keys ui">
      {#each legend as c (c)}<span><i data-cat={c}></i>{CATEGORY_LABEL[c]}</span>{/each}
    </div>
  {/if}
  <div class="die screen host" bind:this={wrap} onscroll={(ev) => (scrollLeft = (ev.currentTarget as HTMLElement).scrollLeft)}>
    {#if device && bits}
      <div class="pad" style:width="{mode === 'bits' ? gridW + LABEL + 8 : 0}px" style:height="1px"></div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions, a11y_no_interactive_element_to_noninteractive_role -->
      <canvas bind:this={canvas} tabindex="0" role="img" aria-label="Configuration bits of {device.name}, one row per frame. Arrow keys move between bits." onpointermove={move} onpointerleave={leave} onclick={click} onkeydown={key}></canvas>
      {#if tip}
        <div class="tip" style:left="{tip.x + (mode === 'bits' ? scrollLeft : 0)}px" style:top="{tip.y}px" role="tooltip"><strong>{tip.sub}</strong><span>{tip.text}</span></div>
      {/if}
    {:else}
      <p class="empty ui">Fit a design to see its configuration bits.</p>
    {/if}
  </div>
  <p class="sr" aria-live="polite">{live}</p>
</div>

<style>
  .bits {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--panel);
  }
  .legend,
  .keys {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem 0.7rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .keys {
    padding-top: 0;
    font-size: 0.66rem;
    color: var(--mute);
    border-bottom: 1px solid var(--line);
  }
  .keys span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .keys i {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
  }
  i[data-cat='lut'] {
    background: var(--sig-high);
  }
  i[data-cat='flag'] {
    background: var(--copper);
  }
  i[data-cat='clock'] {
    background: var(--sig-current);
  }
  i[data-cat='pad'] {
    background: var(--phosphor);
  }
  i[data-cat='mux'] {
    background: var(--silicon-metal);
  }
  i[data-cat='ram-init'] {
    background: var(--volt-neg);
  }
  .grow {
    flex: 1;
  }
  .seg {
    display: inline-flex;
    gap: 2px;
  }
  .seg button {
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 5px;
    cursor: pointer;
  }
  .seg button.on {
    border-color: var(--copper);
    color: var(--copper-ink);
    font-weight: 600;
  }
  .host {
    position: relative;
    flex: 1;
    min-height: 8rem;
    overflow: auto;
    border-radius: 0;
  }
  .pad {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
  }
  canvas {
    position: sticky;
    left: 0;
    top: 0;
    display: block;
    outline: none;
  }
  canvas:focus-visible {
    box-shadow: inset 0 0 0 2px var(--focus);
  }
  .tip {
    position: absolute;
    z-index: 4;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 15.5rem;
    padding: 0.35rem 0.5rem;
    background: color-mix(in srgb, #05070d 92%, transparent);
    border: 1px solid var(--metal-dim);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--die-ink);
  }
  .tip strong {
    color: var(--metal);
  }
  .empty {
    margin: 1rem;
    color: var(--die-ink-2);
    font-size: 0.85rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
