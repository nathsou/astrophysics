// Chapter 3 flagship: the circular restricted three-body problem (CR3BP) in the rotating frame.
// Units: total mass = 1, separation = 1, ω = 1. Background: contours of the effective potential
// Ω(x,y), with the three zero-velocity curves through L1/L2/L3 emphasised. Drag on the canvas to
// launch a test particle: the drag vector sets its rotating-frame velocity. RK4 with distance-
// adaptive substepping integrates each particle (see the <Hood> for why).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { omega, jacobi, rk4Step, lagrangePoints, MU_CRIT, PRESET_MU, type LagrangePoints } from './three-body/cr3bp';
import { marchingSquares, type Grid } from './three-body/contour';

interface Particle {
  s: Float64Array; // x,y,vx,vy
  xs: Float32Array; ys: Float32Array; ts: Float32Array;
  head: number; n: number;
  color: string;
  C0: number;
}

const TRAIL_LEN = 3000;
const MAX_PARTICLES = 5;

// `speed` is the playback rate the preset sets: tadpole and horseshoe librations take tens to
// hundreds of orbital periods (time units of 1/ω), so they are shown fast-forwarded.
const PRESETS: { label: string; mu: number; speed: number; build: (mu: number, L: LagrangePoints) => [number, number, number, number] }[] = [
  {
    label: 'Trojan tadpole', mu: PRESET_MU.sunJupiter.mu, speed: 10,
    build: (mu, L) => [L.L4[0] - 0.03, L.L4[1] + 0.02, 0.02, -0.01],
  },
  {
    // A circular orbit 2% outside the secondary's, started opposite it (by L3): it drifts back
    // towards the secondary, turns round ~17° short of it, and swings all the way back past L3.
    // Horseshoes need a small μ; at the Earth–Moon ratio this start would fall into the primary.
    label: 'Horseshoe', mu: PRESET_MU.sunJupiter.mu, speed: 16,
    build: () => { const r = 1.02; return [-r, 0, 0, r - 1 / Math.sqrt(r)]; },
  },
  {
    label: 'L1 transfer', mu: PRESET_MU.earthMoon.mu, speed: 1,
    build: (mu, L) => [L.L1[0], 0.0, 0.02, 0.36],
  },
  {
    label: 'Chaotic', mu: PRESET_MU.earthMoon.mu, speed: 1,
    build: (mu, L) => [L.L1[0] - 0.01, 0.02, -0.05, 0.55],
  },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop?.invalidate(); });

    const wrap = document.createElement('div');
    host.append(wrap);
    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(wrap, { aspect: narrow ? 1.3 : 16 / 10, maxDpr: 2 });
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'crosshair';
    const ctx = stage.canvas.getContext('2d')!;

    // ---- state
    let mu = PRESET_MU.earthMoon.mu;
    let showInertial = false;
    let showLabels = true;
    let speed = 1;
    let L = lagrangePoints(mu);
    const particles: Particle[] = [];

    // view bounds in data space (fixed; the geometry always fits)
    const view = { x0: -1.7, x1: 1.7, y0: -1.06, y1: 1.06 };
    const toPx = (x: number, y: number): [number, number] => {
      const kx = stage.width / (view.x1 - view.x0), ky = stage.height / (view.y1 - view.y0);
      const k = Math.min(kx, ky);
      const cx = stage.width / 2, cy = stage.height / 2;
      return [cx + x * k, cy - y * k];
    };
    const toData = (px: number, py: number): [number, number] => {
      const kx = stage.width / (view.x1 - view.x0), ky = stage.height / (view.y1 - view.y0);
      const k = Math.min(kx, ky);
      const cx = stage.width / 2, cy = stage.height / 2;
      return [(px - cx) / k, -(py - cy) / k];
    };
    const rot = (x: number, y: number, th: number): [number, number] => {
      const c = Math.cos(th), sn = Math.sin(th);
      return [x * c - y * sn, x * sn + y * c];
    };

    // ---- contour field, recomputed only when μ changes
    const GX = 180, GY = Math.round(GX * (view.y1 - view.y0) / (view.x1 - view.x0));
    const field = new Float64Array(GX * GY);
    let levels: number[] = [];
    let boldLevels: number[] = [];
    function rebuildField() {
      for (let j = 0; j < GY; j++) {
        const y = view.y0 + ((j + 0.5) / GY) * (view.y1 - view.y0);
        for (let i = 0; i < GX; i++) {
          const x = view.x0 + ((i + 0.5) / GX) * (view.x1 - view.x0);
          field[j * GX + i] = Math.log(omega(x, y, mu));
        }
      }
      let lo = Infinity, hi = -Infinity;
      for (const v of field) { if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
      lo = Math.max(lo, Math.log(omega(L.L4[0], L.L4[1], mu)) - 0.6);
      levels = Array.from({ length: 14 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 14);
      boldLevels = [Math.log(omega(L.L1[0], L.L1[1], mu)), Math.log(omega(L.L2[0], L.L2[1], mu)), Math.log(omega(L.L3[0], L.L3[1], mu))];
    }
    const gridToData = (gx: number, gy: number): [number, number] => [
      view.x0 + (gx / GX) * (view.x1 - view.x0),
      view.y0 + (gy / GY) * (view.y1 - view.y0),
    ];

    function setMu(newMu: number) {
      mu = newMu;
      L = lagrangePoints(mu);
      rebuildField();
    }
    setMu(mu);

    // ---- particles
    function launch(x: number, y: number, vx: number, vy: number) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const idx = particles.length;
      const p: Particle = {
        s: new Float64Array([x, y, vx, vy]),
        xs: new Float32Array(TRAIL_LEN), ys: new Float32Array(TRAIL_LEN), ts: new Float32Array(TRAIL_LEN),
        head: 0, n: 0,
        color: pal.series[idx % pal.series.length],
        C0: jacobi([x, y, vx, vy], mu),
      };
      particles.push(p);
      lastLaunch = p;
      loop.invalidate();
    }
    function clearParticles() { particles.length = 0; lastLaunch = null; }
    let lastLaunch: Particle | null = null;

    function preset(p: typeof PRESETS[number]) {
      setMu(p.mu);
      clearParticles();
      const [x, y, vx, vy] = p.build(mu, L);
      launch(x, y, vx, vy);
      muCtl.set(mu);
      speed = p.speed; speedCtl.set(speed);
      loop.invalidate();
    }

    // adaptive RK4: shrink the step near either primary, where curvature is largest.
    function advance(p: Particle, dtChunk: number, t0: number) {
      let remaining = dtChunk, t = t0, guard = 0;
      while (remaining > 1e-9 && guard++ < 800) {
        const r1 = Math.hypot(p.s[0] + mu, p.s[1]), r2 = Math.hypot(p.s[0] - 1 + mu, p.s[1]);
        const h = Math.min(remaining, Math.max(0.0004, 0.012 * Math.min(1, Math.min(r1, r2))));
        rk4Step(p.s, mu, h);
        remaining -= h; t += h;
      }
      p.xs[p.head] = p.s[0]; p.ys[p.head] = p.s[1]; p.ts[p.head] = t;
      p.head = (p.head + 1) % TRAIL_LEN; p.n = Math.min(p.n + 1, TRAIL_LEN);
    }

    let simTime = 0;
    const loop = new Loop((dt) => {
      const dtChunk = dt * speed;
      for (const p of particles) advance(p, dtChunk, simTime);
      simTime += dtChunk;
    }, render, 1 / 90);

    // ---- pointer: drag to set launch position + velocity
    let drag: { start: [number, number] } | null = null;
    let dragNow: [number, number] | null = null;
    stage.canvas.addEventListener('pointerdown', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      drag = { start: toData(e.clientX - r.left, e.clientY - r.top) };
      dragNow = drag.start;
      stage.canvas.setPointerCapture(e.pointerId);
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = stage.canvas.getBoundingClientRect();
      dragNow = toData(e.clientX - r.left, e.clientY - r.top);
      loop.invalidate();
    });
    const endDrag = (e: PointerEvent) => {
      if (!drag || !dragNow) { drag = null; return; }
      const [x0, y0] = drag.start, [x1, y1] = dragNow;
      launch(x0, y0, (x1 - x0) * 1.4, (y1 - y0) * 1.4);
      drag = null; dragNow = null;
    };
    stage.canvas.addEventListener('pointerup', endDrag);
    stage.canvas.addEventListener('pointercancel', endDrag);

    // ---- render
    function drawContours() {
      const grid: Grid = { nx: GX, ny: GY, field };
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.faint;
      ctx.globalAlpha = 0.55;
      for (const lv of levels) {
        const segs = marchingSquares(grid, lv);
        ctx.beginPath();
        for (const [gx0, gy0, gx1, gy1] of segs) {
          const [ax, ay] = gridToData(gx0, gy0), [bx, by] = gridToData(gx1, gy1);
          const [px0, py0] = toPx(ax, ay), [px1, py1] = toPx(bx, by);
          ctx.moveTo(px0, py0); ctx.lineTo(px1, py1);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const boldColors = [pal.accent2, pal.accent3, pal.bad];
      boldLevels.forEach((lv, i) => {
        const segs = marchingSquares(grid, lv);
        ctx.strokeStyle = boldColors[i % boldColors.length];
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (const [gx0, gy0, gx1, gy1] of segs) {
          const [ax, ay] = gridToData(gx0, gy0), [bx, by] = gridToData(gx1, gy1);
          const [px0, py0] = toPx(ax, ay), [px1, py1] = toPx(bx, by);
          ctx.moveTo(px0, py0); ctx.lineTo(px1, py1);
        }
        ctx.stroke();
      });
    }

    function drawBody(x: number, y: number, r: number, glow: string) {
      const [px, py] = toPx(x, y);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.4);
      g.addColorStop(0, glow); g.addColorStop(1, glow.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }

    function labelPoint(x: number, y: number, text: string) {
      const [px, py] = toPx(x, y);
      ctx.fillStyle = pal.muted;
      ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
      if (showLabels) { ctx.font = '11px JetBrains Mono, ui-monospace, monospace'; ctx.fillText(text, px + 6, py - 6); }
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, W, H);

      const th = showInertial ? simTime : 0;

      if (!showInertial) drawContours();

      // primaries
      const p1 = rot(-mu, 0, th), p2 = rot(1 - mu, 0, th);
      drawBody(p1[0], p1[1], Math.max(5, 11 * Math.cbrt(1 - mu)), 'rgba(255,214,140,0.95)');
      drawBody(p2[0], p2[1], Math.max(2.5, 8 * Math.cbrt(mu)), 'rgba(140,190,255,0.95)');

      // Lagrange points
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      (['L1', 'L2', 'L3', 'L4', 'L5'] as const).forEach((k) => {
        const [x, y] = rot(L[k][0], L[k][1], th);
        labelPoint(x, y, k);
      });

      // particle trails
      for (const p of particles) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        const start = (p.head - p.n + TRAIL_LEN) % TRAIL_LEN;
        for (let k = 0; k < p.n; k++) {
          const j = (start + k) % TRAIL_LEN;
          const [rx, ry] = showInertial ? rot(p.xs[j], p.ys[j], p.ts[j]) : [p.xs[j], p.ys[j]];
          const [px, py] = toPx(rx, ry);
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        const [cx, cy] = showInertial ? rot(p.s[0], p.s[1], simTime) : [p.s[0], p.s[1]];
        const [px, py] = toPx(cx, cy);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
      }

      // drag preview
      if (drag && dragNow) {
        const [ax, ay] = toPx(drag.start[0], drag.start[1]);
        const [bx, by] = toPx(dragNow[0], dragNow[1]);
        ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fill();
      }

      // frame label
      ctx.fillStyle = pal.muted;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillText(showInertial ? 'inertial frame' : 'rotating frame', 10, H - 10);

      updateReadout();
    }

    stage.onResize(() => loop.invalidate());

    // ---- controls
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Clear', () => { clearParticles(); loop.invalidate(); });
    const muCtl = panel.slider('Mass ratio μ', { min: 0.0005, max: 0.45, value: mu, log: true, format: (v) => fmt(v, 3) }, (v) => { setMu(v); loop.invalidate(); });
    panel.toggle('Inertial frame', showInertial, (v) => { showInertial = v; loop.invalidate(); });
    panel.toggle('Labels', showLabels, (v) => { showLabels = v; loop.invalidate(); });
    const speedCtl = panel.slider('Speed', { min: 0.1, max: 20, value: speed, log: true, format: (v) => `${fmt(v, 2)}×` }, (v) => { speed = v; });
    panel.button('Earth–Moon', () => { setMu(PRESET_MU.earthMoon.mu); muCtl.set(mu); loop.invalidate(); });
    panel.button('Sun–Jupiter', () => { setMu(PRESET_MU.sunJupiter.mu); muCtl.set(mu); loop.invalidate(); });
    panel.button('Equal-ish', () => { setMu(PRESET_MU.equal.mu); muCtl.set(mu); loop.invalidate(); });
    for (const p of PRESETS) panel.button(p.label, () => preset(p));
    const ro = panel.readout('');
    function updateReadout() {
      const stable = mu < MU_CRIT ? 'stable' : 'unstable';
      let jline = '';
      if (lastLaunch) {
        const C = jacobi(lastLaunch.s, mu);
        const drift = Math.abs((C - lastLaunch.C0) / lastLaunch.C0);
        jline = ` · C = ${fmt(C, 5)} (drift ${fmt(drift * 100, 2)}%)`;
      }
      ro.set(`μ = ${fmt(mu, 4)} · μ_crit = ${fmt(MU_CRIT, 4)} · L4/L5 ${stable}${jline}`);
    }
    // start with something moving: the L1 transfer (Earth–Moon mass ratio, the default)
    preset(PRESETS[2]);

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
