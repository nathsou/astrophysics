<!--
  The latch as a ball in a double well. The landscape has two valleys (the two stable states of an SR latch) and a hump
  between them (the metastable point). S and R tilt it. Hold both and let go together, and the ball is left balanced on
  the hump, and falls after a random time: the time and the side come from the digital engine's SR latch, which is drawn
  beside it, running, with its outputs going X while it hangs.

    ::double-well{n="16.3"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LiveBench from '../../15-timing/widgets/LiveBench.svelte';
  import type { Engine } from '$lib/sim/engine';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { FALLBACK, onThemeChange, readSignals, type Signals } from '$lib/theme/signals';
  import base from '../circuits/sr-behavioural.json';
  import { landscape, potential, release, step, type Ball, type Pushes } from './well';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let tau = $state(2);
  let pace: 'slow' | 'normal' = $state('normal');
  const SPEED = { slow: 0.7e-9, normal: 1.5e-9 };
  let engine: Engine | null = $state(null);
  let holding: 'none' | 's' | 'r' | 'both' = $state('none');
  let said = $state('The latch holds 0: the ball is in the left valley.');
  let hung = $state(0);

  const circuit = $derived.by(() => {
    const c = structuredClone(base) as unknown as Circuit;
    const l = c.components.find((x) => x.id === 'L1')!;
    l.params = { ...l.params, tau };
    return c;
  });

  let canvas: HTMLCanvasElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let width = $state(640);
  const H = 230;
  let colours: Signals = FALLBACK.light;
  const ball: Ball = { x: -1, v: 0 };
  let prevMeta = false;
  let metaFrom = 0;
  let clock = 0;
  let visible = false;
  let raf = 0;
  let reduced = false;

  // A new engine (a new tau): a real reset pulse first, because a latch that has just powered up with unknown inputs is
  // itself unknown; then the ball starts in the valley of the latch's value.
  function ready(e: Engine) {
    e.setParam('R', 'on', true);
    e.advance(4e-9);
    e.setParam('R', 'on', false);
    e.advance(4e-9);
    const st = e.state('L1');
    ball.x = st.q === 1 ? 1 : -1;
    ball.v = 0;
    prevMeta = false;
    said = st.q === 1 ? 'The latch holds 1: the ball is in the right valley.' : 'The latch holds 0: the ball is in the left valley.';
  }

  function pushes(e: Engine): Pushes {
    return { s: !!e.state('S').on, r: !!e.state('R').on };
  }

  function hold(kind: 's' | 'r' | 'both') {
    const e = engine;
    if (!e || holding !== 'none') return;
    holding = kind;
    e.setParam('S', 'on', kind !== 'r');
    e.setParam('R', 'on', kind !== 's');
  }
  /** Let go of every button at the same instant, as one release does. */
  function letGo() {
    const e = engine;
    if (!e || holding === 'none') return;
    holding = 'none';
    e.setParam('S', 'on', false);
    e.setParam('R', 'on', false);
  }
  const down = (kind: 's' | 'r' | 'both') => (ev: PointerEvent) => {
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    hold(kind);
  };
  const keyDown = (kind: 's' | 'r' | 'both') => (ev: KeyboardEvent) => {
    if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) {
      ev.preventDefault();
      hold(kind);
    }
  };
  const keyUp = (ev: KeyboardEvent) => {
    if (ev.key === ' ' || ev.key === 'Enter') letGo();
  };

  function frame(dt: number) {
    const e = engine;
    if (!e) return;
    clock += dt;
    const st = e.state('L1');
    const meta = !!st.metastable;
    const p = pushes(e);
    if (meta && !prevMeta) {
      metaFrom = e.time;
      said = 'S and R were let go together. The latch has no reason to choose a side: the ball is balanced on the hump, and the outputs are unknown (X).';
    }
    if (!meta && prevMeta) {
      release(ball, st.q === 1 ? 1 : 0);
      said = `The ball fell to the ${st.q === 1 ? 'right' : 'left'} after ${hung.toFixed(1)} ns. The latch holds ${st.q === 1 ? 1 : 0}. It could as easily have been the other side, after a different time.`;
    }
    if (meta) hung = (e.time - metaFrom) * 1e9;
    prevMeta = meta;
    step(ball, p, reduced ? 0.5 : Math.min(dt, 0.05), { metastable: meta, t: clock });
    if (!meta && !prevMeta) {
      if (p.s && p.r) said = 'Both buttons are down: both outputs of a NOR latch are forced to 0. The valleys have merged into one bowl under the ball.';
      else if (p.s && st.q === 1 && Math.abs(ball.x - 1.2) < 0.4 && said.startsWith('The latch holds')) said = 'S is down: the landscape tilts and the left valley has gone. The ball rolls right. The latch is set: Q = 1.';
      else if (p.r && st.q === 0 && Math.abs(ball.x + 1.2) < 0.4 && said.startsWith('The latch holds')) said = 'R is down: the landscape tilts the other way. The ball rolls left. The latch is reset: Q = 0.';
    }
    draw(p, meta, st.q === 1 ? 1 : 0);
  }

  function draw(p: Pushes, meta: boolean, q: number) {
    const c = canvas;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(240, width);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    const col = colours;
    const { a, h } = landscape(p);
    const X0 = 1.95;
    const px = (x: number) => w / 2 + (x / X0) * (w / 2 - 14);
    const yMid = 96;
    const kY = 52;
    const py = (x: number) => Math.min(H - 40, Math.max(22, yMid - potential(x, a, h) * kY));
    // The ground under the landscape.
    ctx.beginPath();
    ctx.moveTo(px(-X0), H - 30);
    for (let i = 0; i <= 160; i++) {
      const x = -X0 + (2 * X0 * i) / 160;
      ctx.lineTo(px(x), py(x));
    }
    ctx.lineTo(px(X0), H - 30);
    ctx.closePath();
    ctx.fillStyle = col.line;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const x = -X0 + (2 * X0 * i) / 160;
      if (i === 0) ctx.moveTo(px(x), py(x));
      else ctx.lineTo(px(x), py(x));
    }
    ctx.strokeStyle = col.wire;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Labels.
    ctx.font = '600 11px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = col.mute;
    ctx.fillText('Q = 0', px(-1), H - 12);
    ctx.fillText('Q = 1', px(1), H - 12);
    if (a > 0 && Math.abs(h) < 0.3) ctx.fillText(w < 480 ? 'hump' : 'the hump: metastable', px(0), H - 12);
    // The pushes.
    ctx.fillStyle = col.high;
    ctx.textAlign = 'left';
    if (p.s && !p.r) ctx.fillText('S pushes right ▶', w - 130, 18);
    ctx.textAlign = 'right';
    if (p.r && !p.s) ctx.fillText('◀ R pushes left', 130, 18);
    ctx.textAlign = 'center';
    if (p.s && p.r) ctx.fillText('S and R: one bowl', w / 2, 18);
    // The ball.
    const bx = px(ball.x);
    const by = py(ball.x) - 11;
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = meta ? col.x : p.s && p.r ? col.mute : q ? col.high : col.low;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col.fg;
    ctx.stroke();
    if (meta) {
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(bx, by, 17, 0, Math.PI * 2);
      ctx.strokeStyle = col.x;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col.fg;
      ctx.textAlign = 'center';
      ctx.fillText(`balanced for ${hung.toFixed(1)} ns`, w / 2, 40);
    }
  }

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (canvas) colours = readSignals(canvas);
    const stopTheme = onThemeChange(() => {
      if (canvas) colours = readSignals(canvas);
    });
    const ro = new ResizeObserver(([entry]) => {
      if (entry) width = entry.contentRect.width;
    });
    if (wrap) ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => (visible = !!entry?.isIntersecting));
    if (wrap) io.observe(wrap);
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      if (visible && !document.hidden) frame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      stopTheme();
      ro.disconnect();
      io.disconnect();
    };
  });
</script>

<Widget {n} title="A latch is a ball in a double well" subtitle="Two valleys remember; the hump between them cannot decide" kind="Lab bench" {caption} onreset={() => ((tau = 2), (holding = 'none'))} live={false}>
  {#snippet controls()}
    <Button size="sm" aria-pressed={holding === 's'} onpointerdown={down('s')} onpointerup={letGo} onpointercancel={letGo} onkeydown={keyDown('s')} onkeyup={keyUp}>Hold S (set)</Button>
    <Button size="sm" aria-pressed={holding === 'r'} onpointerdown={down('r')} onpointerup={letGo} onpointercancel={letGo} onkeydown={keyDown('r')} onkeyup={keyUp}>Hold R (reset)</Button>
    <Button size="sm" variant="primary" aria-pressed={holding === 'both'} onpointerdown={down('both')} onpointerup={letGo} onpointercancel={letGo} onkeydown={keyDown('both')} onkeyup={keyUp}>Hold S and R, then let go</Button>
    <Slider label="Time constant τ" bind:value={tau} min={0.5} max={5} step={0.5} compact format={(v) => `${v.toFixed(1)} ns`} />
    <Segmented label="Playback speed" size="sm" bind:value={pace} options={[{ value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }]} />
  {/snippet}

  <div class="dw">
    <div class="well" bind:this={wrap}>
      <canvas bind:this={canvas} style:width="{width}px" style:height="{H}px" role="img" aria-label="A ball on a landscape with two valleys and a hump between them. The right valley is a latch holding 1, the left one a latch holding 0."></canvas>
    </div>
    <p class="said ui" role="status" aria-live="polite">{said}</p>
    <LiveBench {circuit} traces="S,R,Q,Qn" window={24e-9} speed={SPEED[pace]} scale={1.15} bind:engine onready={ready} label="An SR latch with two logic switches and two indicators" />
  </div>
</Widget>

<style>
  .dw {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .well {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    overflow: hidden;
  }
  canvas {
    display: block;
    max-width: 100%;
  }
  .said {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface-2, var(--panel));
    font-size: 0.86rem;
    color: var(--ink-2);
    min-height: 3.2em;
  }
</style>
