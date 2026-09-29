<!--
  Scrolling digital waveforms of a few nets, drawn on a canvas from engine.watch() so short glitches
  are not lost between frames. HIGH and LOW are lines at two levels (HIGH with a light amber fill),
  Z a dashed line at mid-level, X a hatched red band; transitions are short slants.
  With `live` (default) it redraws itself every animation frame; a host can pass live={false} and
  call frame().
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Engine, Recorder } from '../sim/engine';
  import type { Trace } from './traces';
  import { spans, ticks } from './waves';
  import { formatSI } from './format';
  import { FALLBACK, onThemeChange, readSignals, type Signals } from '../theme/signals';

  let {
    engine,
    traces,
    window: span = 1e-6,
    rowHeight = 30,
    live = true,
    label = 'Timing diagram',
  }: {
    engine: Engine | null;
    traces: Trace[];
    /** Simulated seconds visible across the width. */
    window?: number;
    rowHeight?: number;
    live?: boolean;
    label?: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let width = $state(600);
  let recorder: Recorder | null = null;
  const AXIS = 22;
  const NAMES = $derived(Math.max(44, 10 + 7.2 * Math.max(0, ...traces.map((t) => t.name.length))));
  const height = $derived(traces.length * rowHeight + AXIS + 6);

  $effect(() => {
    const e = engine;
    const nets = traces.map((t) => t.net);
    if (!e || !nets.length) return;
    const r = e.watch(nets);
    recorder = r;
    return () => {
      r.close();
      if (recorder === r) recorder = null;
    };
  });

  // Canvas cannot resolve var(): read the signal tokens (resolved for this element's theme).
  let colours: Signals = FALLBACK.light;
  const readColours = () => {
    if (canvas) colours = readSignals(canvas);
  };

  /** Redraw from the recorder. */
  export function frame(): void {
    const c = canvas;
    const e = engine;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(100, width);
    const h = height;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const x0 = NAMES;
    const x1 = w - 8;
    // Sweeps in from the left until a full window has elapsed, then scrolls.
    const now = e ? e.time : 0;
    const t0 = Math.max(0, now - span);
    const t1 = t0 + span;
    const X = (t: number) => x0 + ((t - t0) / span) * (x1 - x0);
    const col = colours;

    // Grid and axis.
    ctx.font = '10px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const axisY = traces.length * rowHeight + 4;
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 1;
    ctx.fillStyle = col.mute;
    ctx.textAlign = 'center';
    for (const t of ticks(t0, t1, Math.max(2, Math.floor((x1 - x0) / 90))).filter((t) => t >= 0)) {
      const x = Math.round(X(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x, axisY + 3);
      ctx.stroke();
      ctx.fillText(formatSI(t, 's', 3), x, axisY + 11);
    }
    ctx.strokeStyle = col.mute;
    ctx.beginPath();
    ctx.moveTo(x0, axisY + 0.5);
    ctx.lineTo(x1, axisY + 0.5);
    ctx.stroke();

    const rec = recorder;
    const times = rec?.times();
    const values = rec?.values();
    const analog = e?.kind === 'analog';
    traces.forEach((tr, row) => {
      const top = row * rowHeight + 6;
      const yHi = top + 3;
      const yLo = top + rowHeight - 9;
      const yMid = (yHi + yLo) / 2;
      ctx.fillStyle = col.fg;
      ctx.textAlign = 'left';
      ctx.font = '600 11px "JetBrains Mono Variable", ui-monospace, monospace';
      ctx.fillText(tr.name, 4, yMid);
      if (!times || !values?.[row]) return;
      const ss = spans(times, values[row]!, t0, now, analog);
      const slant = Math.min(3, (x1 - x0) / 200);
      // Fills first (HIGH tint, X hatching), then lines.
      for (const s of ss) {
        const a = X(s.t0);
        const b = X(s.t1);
        if (s.v === 1) {
          ctx.fillStyle = col.high;
          ctx.globalAlpha = 0.16;
          ctx.fillRect(a, yHi, b - a, yLo - yHi);
          ctx.globalAlpha = 1;
        } else if (s.v === 2) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(a, yHi, Math.max(1, b - a), yLo - yHi);
          ctx.clip();
          ctx.fillStyle = col.x;
          ctx.globalAlpha = 0.14;
          ctx.fillRect(a, yHi, b - a, yLo - yHi);
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = col.x;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = a - (yLo - yHi); x < b; x += 5) {
            ctx.moveTo(x, yLo);
            ctx.lineTo(x + (yLo - yHi), yHi);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      let prevY: number | undefined;
      for (const s of ss) {
        const a = X(s.t0);
        const b = X(s.t1);
        const y = s.v === 1 ? yHi : s.v === 0 ? yLo : yMid;
        ctx.lineWidth = s.v === 1 ? 2.5 : 1.8;
        ctx.strokeStyle = s.v === 1 ? col.high : s.v === 0 ? col.low : s.v === 3 ? col.z : col.x;
        ctx.setLineDash(s.v === 3 ? [4, 3] : []);
        ctx.beginPath();
        if (s.v === 2) {
          ctx.moveTo(a, yHi);
          ctx.lineTo(b, yHi);
          ctx.moveTo(a, yLo);
          ctx.lineTo(b, yLo);
        } else {
          const start = prevY !== undefined && prevY !== y ? a + slant : a;
          if (prevY !== undefined && prevY !== y) {
            ctx.moveTo(a - 0, prevY);
            ctx.lineTo(start, y);
          } else ctx.moveTo(a, y);
          ctx.lineTo(Math.max(start, b), y);
        }
        ctx.stroke();
        prevY = s.v === 2 ? undefined : y;
      }
      ctx.setLineDash([]);
    });
    rec?.trim(span * 1.5);
  }

  onMount(() => {
    readColours();
    const stopTheme = onThemeChange(() => {
      readColours();
      frame();
    });
    const ro = new ResizeObserver(([entry]) => {
      if (entry) width = entry.contentRect.width;
      frame();
    });
    if (wrap) ro.observe(wrap);
    let raf = 0;
    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };
    if (live) raf = requestAnimationFrame(loop);
    return () => {
      stopTheme();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="timing" bind:this={wrap} role="img" aria-label="{label}: {traces.map((t) => t.name).join(', ')}">
  <canvas bind:this={canvas} style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>
</div>

<style>
  .timing {
    width: 100%;
    min-width: 0;
  }
  canvas {
    display: block;
    max-width: 100%;
  }
</style>
