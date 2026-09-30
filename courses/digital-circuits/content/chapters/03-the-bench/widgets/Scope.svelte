<!--
  The screen of the simulated oscilloscope: graticule, traces with afterglow, trigger marker, cursors.
  It only draws. The host runs the rig (engine + recorder + ScopeModel) and calls `draw(partial)` each
  frame; dragging a cursor or the trigger-level arrow changes `cursors` / `model.trigger.level` and
  calls `onchange` (the host also offers sliders, so everything is reachable from the keyboard).
-->
<script lang="ts" module>
  import type { SignalName } from '$lib/theme/signals';

  export interface ChannelView {
    name: string;
    voltsPerDiv: number;
    /** Divisions above the screen centre where 0 V is drawn. */
    position: number;
    colour: SignalName;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { FALLBACK, onThemeChange, readSignals, withAlpha, type Signals } from '$lib/theme/signals';
  import { formatSI } from '$lib/bench/format';
  import { COLS, DIVS_X, DIVS_Y, type Cursors, type PartialSweep, type ScopeModel } from './scope-model';

  let {
    model,
    channels,
    cursors = $bindable(),
    cursorChannel = 0,
    label = 'Oscilloscope screen',
    onchange,
    status = '',
  }: {
    model: ScopeModel;
    channels: ChannelView[];
    cursors?: Cursors;
    cursorChannel?: number;
    label?: string;
    onchange?: () => void;
    /** Overrides the status text (e.g. "Stop"). */
    status?: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let width = $state(600);
  const height = $derived(Math.round(Math.min(340, Math.max(200, width * 0.56))));
  let sig: Signals = FALLBACK.dark;
  let lastPartial: PartialSweep | null = null;
  let drag: { kind: 't1' | 't2' | 'v1' | 'v2' | 'level' } | null = null;

  const FONT = '11px "JetBrains Mono Variable", ui-monospace, monospace';

  /** Canvas y of a voltage on channel `ch`. */
  function yOf(v: number, ch: ChannelView): number {
    const div = height / DIVS_Y;
    return height / 2 - (ch.position + v / ch.voltsPerDiv) * div;
  }
  function voltOf(y: number, ch: ChannelView): number {
    const div = height / DIVS_Y;
    return ((height / 2 - y) / div - ch.position) * ch.voltsPerDiv;
  }

  export function draw(partial: PartialSweep | null = lastPartial): void {
    lastPartial = partial;
    const c = canvas;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(120, width);
    const H = height;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = sig.scopeBg;
    ctx.fillRect(0, 0, W, H);

    // Graticule.
    const dx = W / DIVS_X;
    const dy = H / DIVS_Y;
    ctx.lineWidth = 1;
    ctx.strokeStyle = sig.scopeGrid;
    ctx.beginPath();
    for (let i = 1; i < DIVS_X; i++) {
      const x = Math.round(i * dx) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let j = 1; j < DIVS_Y; j++) {
      const y = Math.round(j * dy) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // Centre axes with fine ticks.
    ctx.strokeStyle = withAlpha(sig.phosphor, 0.32);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(H / 2) + 0.5);
    ctx.lineTo(W, Math.round(H / 2) + 0.5);
    ctx.moveTo(Math.round(W / 2) + 0.5, 0);
    ctx.lineTo(Math.round(W / 2) + 0.5, H);
    for (let i = 0; i <= DIVS_X * 5; i++) {
      const x = Math.round((i * dx) / 5) + 0.5;
      ctx.moveTo(x, H / 2 - 3);
      ctx.lineTo(x, H / 2 + 3);
    }
    for (let j = 0; j <= DIVS_Y * 5; j++) {
      const y = Math.round((j * dy) / 5) + 0.5;
      ctx.moveTo(W / 2 - 3, y);
      ctx.lineTo(W / 2 + 3, y);
    }
    ctx.stroke();

    // Traces, clipped to the screen.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const sweeps = model.sweeps;
    const older = sweeps.slice(0, -1);
    channels.forEach((ch, ci) => {
      const colour = sig[ch.colour];
      const drawEnv = (min: Float32Array, max: Float32Array, alpha: number, width: number) => {
        ctx.strokeStyle = withAlpha(colour, alpha);
        ctx.lineWidth = width;
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k < COLS; k++) {
          const lo = min[k]!;
          const hi = max[k]!;
          if (Number.isNaN(lo)) {
            pen = false;
            continue;
          }
          const x = ((k + 0.5) / COLS) * W;
          const y = yOf((lo + hi) / 2, ch);
          if (pen) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = true;
        }
        ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < COLS; k++) {
          const lo = min[k]!;
          const hi = max[k]!;
          if (Number.isNaN(lo)) continue;
          const y1 = yOf(hi, ch);
          const y2 = yOf(lo, ch);
          if (y2 - y1 > 1.5) {
            const x = ((k + 0.5) / COLS) * W;
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
          }
        }
        ctx.stroke();
      };
      older.forEach((sw, i) => drawEnv(sw.min[ci]!, sw.max[ci]!, 0.12 + (0.3 * (i + 1)) / Math.max(1, older.length), 1.4));
      const newest = sweeps[sweeps.length - 1];
      if (newest) {
        ctx.shadowColor = colour;
        ctx.shadowBlur = 6;
        drawEnv(newest.min[ci]!, newest.max[ci]!, 0.95, 1.8);
        ctx.shadowBlur = 0;
      }
      if (partial && !newest) drawEnv(partial.min[ci]!, partial.max[ci]!, 0.9, 1.6);
    });
    ctx.restore();

    // Ground markers (a tag at the left edge for each channel's 0 V).
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    channels.forEach((ch, i) => {
      const y = yOf(0, ch);
      if (y < 6 || y > H - 6) return;
      ctx.fillStyle = sig[ch.colour];
      ctx.beginPath();
      ctx.moveTo(0, y - 5);
      ctx.lineTo(9, y);
      ctx.lineTo(0, y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = sig.scopeBg;
      ctx.font = '600 8px "JetBrains Mono Variable", ui-monospace, monospace';
      ctx.fillText(String(i + 1), 1, y + 0.5);
    });

    // Trigger position (top edge) and level (left edge, on the trigger channel).
    const tr = model.trigger;
    if (tr.mode !== 'off') {
      const tx = tr.position * W;
      ctx.fillStyle = sig.high;
      ctx.beginPath();
      ctx.moveTo(tx - 5, 0);
      ctx.lineTo(tx + 5, 0);
      ctx.lineTo(tx, 7);
      ctx.closePath();
      ctx.fill();
      const tch = channels[Math.min(tr.channel, channels.length - 1)];
      if (tch) {
        const ly = yOf(tr.level, tch);
        ctx.strokeStyle = withAlpha(sig.high, drag?.kind === 'level' ? 0.7 : 0.28);
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(10, ly + 0.5);
        ctx.lineTo(W, ly + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = sig.high;
        ctx.beginPath();
        ctx.moveTo(W, ly - 5);
        ctx.lineTo(W - 9, ly);
        ctx.lineTo(W, ly + 5);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Cursors.
    const cur = cursors;
    const cch = channels[Math.min(cursorChannel, channels.length - 1)];
    if (cur?.on && cch) {
      ctx.font = FONT;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(sig.fg, 0.75);
      ctx.fillStyle = sig.fg;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.beginPath();
      (
        [
          ['T1', cur.t1],
          ['T2', cur.t2],
        ] as const
      ).forEach(([, t]) => {
        const x = Math.round((t / DIVS_X) * W) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      });
      (
        [
          ['V1', cur.v1],
          ['V2', cur.v2],
        ] as const
      ).forEach(([, v]) => {
        const y = Math.round(yOf(v, cch)) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [name, t] of [
        ['T1', cur.t1],
        ['T2', cur.t2],
      ] as const) {
        const x = (t / DIVS_X) * W;
        ctx.fillStyle = sig.fg;
        ctx.fillRect(x - 10, H - 15, 20, 13);
        ctx.fillStyle = sig.scopeBg;
        ctx.textBaseline = 'middle';
        ctx.fillText(name, x, H - 8.5);
      }
      ctx.textAlign = 'right';
      for (const [name, v] of [
        ['V1', cur.v1],
        ['V2', cur.v2],
      ] as const) {
        const y = yOf(v, cch);
        ctx.fillStyle = sig.fg;
        ctx.fillRect(W - 40, y - 6.5, 20, 13);
        ctx.fillStyle = sig.scopeBg;
        ctx.fillText(name, W - 21, y + 0.5);
      }
    }

    // Readouts on the screen: timebase, volts per division, trigger state.
    ctx.font = FONT;
    ctx.textAlign = 'left';
    let x = 12;
    ctx.fillStyle = withAlpha(sig.phosphor, 0.85);
    const tb = `${formatSI(model.timebase, 's', 2)}/div`;
    ctx.textBaseline = 'top';
    ctx.fillText(tb, x, 6);
    x += ctx.measureText(tb).width + 14;
    channels.forEach((ch, i) => {
      const t = `${i + 1}: ${formatSI(ch.voltsPerDiv, 'V', 2)}/div`;
      ctx.fillStyle = sig[ch.colour];
      ctx.fillText(t, x, 6);
      x += ctx.measureText(t).width + 14;
    });
    ctx.textAlign = 'right';
    ctx.fillStyle = withAlpha(sig.phosphor, 0.85);
    const st = status || model.status();
    ctx.fillText(st, W - 14, 6);
  }

  // Pointer handling: drag cursors and the trigger-level arrow.
  function pick(px: number, py: number): typeof drag {
    const W = width;
    const cch = channels[Math.min(cursorChannel, channels.length - 1)];
    const tr = model.trigger;
    const tch = channels[Math.min(tr.channel, channels.length - 1)];
    if (tr.mode !== 'off' && tch) {
      const ly = yOf(tr.level, tch);
      if (px > W - 26 && Math.abs(py - ly) < 12) return { kind: 'level' };
    }
    const cur = cursors;
    if (cur?.on && cch) {
      let best: { kind: 't1' | 't2' | 'v1' | 'v2'; d: number } | null = null;
      const consider = (kind: 't1' | 't2' | 'v1' | 'v2', d: number) => {
        if (d < 12 && (!best || d < best.d)) best = { kind, d };
      };
      consider('t1', Math.abs(px - (cur.t1 / DIVS_X) * W));
      consider('t2', Math.abs(px - (cur.t2 / DIVS_X) * W));
      consider('v1', Math.abs(py - yOf(cur.v1, cch)));
      consider('v2', Math.abs(py - yOf(cur.v2, cch)));
      if (best) return { kind: (best as { kind: 't1' | 't2' | 'v1' | 'v2' }).kind };
    }
    return null;
  }
  function move(px: number, py: number) {
    if (!drag) return;
    const W = width;
    const cch = channels[Math.min(cursorChannel, channels.length - 1)];
    const tr = model.trigger;
    const tch = channels[Math.min(tr.channel, channels.length - 1)];
    const clampX = (v: number) => Math.min(DIVS_X, Math.max(0, v));
    if (drag.kind === 'level' && tch) {
      const v = voltOf(py, tch);
      tr.level = Math.round(v * 20) / 20;
    } else if (cursors && cch) {
      if (drag.kind === 't1') cursors.t1 = Math.round(clampX((px / W) * DIVS_X) * 20) / 20;
      else if (drag.kind === 't2') cursors.t2 = Math.round(clampX((px / W) * DIVS_X) * 20) / 20;
      else if (drag.kind === 'v1') cursors.v1 = Math.round(voltOf(py, cch) * 50) / 50;
      else if (drag.kind === 'v2') cursors.v2 = Math.round(voltOf(py, cch) * 50) / 50;
    }
    onchange?.();
    draw();
  }
  function rel(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  }
  function down(e: PointerEvent) {
    const [x, y] = rel(e);
    drag = pick(x, y);
    if (drag) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }
  function moved(e: PointerEvent) {
    const [x, y] = rel(e);
    if (drag) move(x, y);
    else if (canvas) canvas.style.cursor = pick(x, y) ? (pick(x, y)!.kind[0] === 't' ? 'ew-resize' : 'ns-resize') : 'default';
  }
  function up() {
    drag = null;
    draw();
  }

  onMount(() => {
    const read = () => {
      if (wrap) sig = readSignals(wrap);
    };
    read();
    const stop = onThemeChange(() => {
      read();
      draw();
    });
    const ro = new ResizeObserver(([entry]) => {
      if (entry) width = entry.contentRect.width;
      queueMicrotask(() => draw());
    });
    if (wrap) ro.observe(wrap);
    draw();
    return () => {
      stop();
      ro.disconnect();
    };
  });

  // Redraw when the reader changes the cursors or the size from outside.
  $effect(() => {
    void cursors?.on;
    void cursors?.t1;
    void cursors?.t2;
    void cursors?.v1;
    void cursors?.v2;
    void height;
    void status;
    void channels.map((c) => c.voltsPerDiv + c.position);
    void model.trigger.level;
    void model.trigger.mode;
    void model.trigger.position;
    draw();
  });
</script>

<div class="screen" role="img" aria-label={label} bind:this={wrap}>
  <canvas
    bind:this={canvas}
    style:height="{height}px"
    aria-hidden="true"
    onpointerdown={down}
    onpointermove={moved}
    onpointerup={up}
    onpointercancel={up}
  ></canvas>
</div>

<style>
  .screen {
    /* Resolve the theme tokens in their dark variant: the screen is a dark phosphor display in both themes. */
    color-scheme: dark;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: var(--scope-bg);
    box-shadow: inset 0 0 24px rgb(0 0 0 / 0.55);
    min-width: 0;
  }
  canvas {
    display: block;
    width: 100%;
    touch-action: pan-y;
    background-color: var(--scope-bg);
    background-image:
      linear-gradient(to right, var(--scope-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--scope-grid) 1px, transparent 1px);
    background-size: 10% 100%, 100% 12.5%;
  }
</style>
