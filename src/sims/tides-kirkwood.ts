// Secondary figure: mean-motion resonances carve gaps in the asteroid belt. Massless test
// particles orbit the Sun on fixed Keplerian ellipses that we perturb each step with Jupiter's
// (circular) gravity, integrated directly in Cartesian coordinates — cheap enough in double
// precision for a few hundred bodies. Watch gaps open at the 3:1, 5:2 and 2:1 resonances with Jupiter.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const GM = 4 * Math.PI * Math.PI; // AU, yr, M_sun
const aJup = 5.2;
const MJupRatio = 1 / 1047; // Jupiter mass in solar masses

function accelFrom(x: number, y: number, sx: number, sy: number, GMs: number): [number, number] {
  const dx = x - sx, dy = y - sy;
  const r2 = dx * dx + dy * dy;
  const inv = GMs / (r2 * Math.sqrt(r2) + 1e-9);
  return [-dx * inv, -dy * inv];
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 1.5 });
    const ctx = stage.canvas.getContext('2d')!;
    const histStage = createStage(host, { aspect: 1 / 0.42 });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const hist = new Plot(histStage.canvas, {
      x: { min: 2.0, max: 3.6, label: 'semi-major axis (AU)' },
      y: { min: 0, max: 1, label: 'count' },
      grid: true,
    });

    const N = 500;
    const a0 = new Float64Array(N);
    const pos = new Float64Array(N * 2);
    const vel = new Float64Array(N * 2);

    function reset() {
      for (let i = 0; i < N; i++) {
        const a = 2.0 + (3.6 - 2.0) * (i + 0.5) / N;
        const e = 0.02 + Math.random() * 0.05;
        const th = Math.random() * 2 * Math.PI;
        const r = a * (1 - e * Math.cos(th)); // cheap eccentric approx for initial placement
        a0[i] = a;
        pos[i * 2] = r * Math.cos(th);
        pos[i * 2 + 1] = r * Math.sin(th);
        const v = Math.sqrt(GM * (2 / r - 1 / a));
        vel[i * 2] = -v * Math.sin(th);
        vel[i * 2 + 1] = v * Math.cos(th);
      }
      years = 0;
    }

    let jupAng = 0;
    let years = 0;
    reset();

    function semiMajor(i: number): number {
      const x = pos[i * 2], y = pos[i * 2 + 1], vx = vel[i * 2], vy = vel[i * 2 + 1];
      const r = Math.hypot(x, y), v2 = vx * vx + vy * vy;
      const invA = 2 / r - v2 / GM;
      return 1 / invA;
    }

    const s = { yrPerSec: 400, jupMass: 1 };
    function step(h: number) {
      const nSub = Math.max(1, Math.round(s.yrPerSec * h / 4));
      const sh = (s.yrPerSec * h) / nSub;
      for (let k = 0; k < nSub; k++) {
        jupAng += sh * (2 * Math.PI / Math.pow(aJup, 1.5));
        const sx = aJup * Math.cos(jupAng), sy = aJup * Math.sin(jupAng);
        for (let i = 0; i < N; i++) {
          const x = pos[i * 2], y = pos[i * 2 + 1];
          const [ax0, ay0] = accelFrom(x, y, 0, 0, GM);
          const [ax1, ay1] = accelFrom(x, y, sx, sy, GM * MJupRatio * s.jupMass);
          vel[i * 2] += (ax0 + ax1) * sh;
          vel[i * 2 + 1] += (ay0 + ay1) * sh;
          pos[i * 2] += vel[i * 2] * sh;
          pos[i * 2 + 1] += vel[i * 2 + 1] * sh;
        }
        years += sh;
      }
    }

    const BINS = 64;
    const counts = new Float64Array(BINS);
    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) / 8;
      const cx = W / 2, cy = H / 2;

      ctx.fillStyle = pal.series[3];
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      const sx = cx + aJup * scale * Math.cos(jupAng), sy = cy - aJup * scale * Math.sin(jupAng);
      ctx.strokeStyle = pal.faint; ctx.beginPath(); ctx.arc(cx, cy, aJup * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = pal.series[2];
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Jupiter', sx, sy - 12);

      counts.fill(0);
      for (let i = 0; i < N; i++) {
        const x = pos[i * 2], y = pos[i * 2 + 1];
        ctx.fillStyle = pal.series[0];
        ctx.globalAlpha = 0.65;
        ctx.fillRect(cx + x * scale - 1, cy - y * scale - 1, 2, 2);
        const a = semiMajor(i);
        const bin = Math.floor(((a - 2.0) / 1.6) * BINS);
        if (bin >= 0 && bin < BINS) counts[bin]++;
      }
      ctx.globalAlpha = 1;

      const resonances: [number, string][] = [[2.5, '3:1'], [2.82, '5:2'], [3.28, '2:1']];
      for (const [a] of resonances) {
        ctx.strokeStyle = pal.bad; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.arc(cx, cy, a * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }

      let maxC = 1;
      for (const c of counts) maxC = Math.max(maxC, c);
      hist.o.y.max = maxC * 1.15;
      hist.draw(() => {
        for (let b = 0; b < BINS; b++) {
          const a = 2.0 + (1.6 * (b + 0.5)) / BINS;
          const x0 = hist.px(2.0 + (1.6 * b) / BINS), x1 = hist.px(2.0 + (1.6 * (b + 1)) / BINS);
          const y0 = hist.py(0), y1 = hist.py(counts[b]);
          hist.ctx.fillStyle = pal.series[0];
          hist.ctx.fillRect(x0, y1, Math.max(1, x1 - x0 - 1), y0 - y1);
        }
        for (const [a, label] of resonances) {
          hist.vline(a, { color: pal.bad, label });
        }
      });

      readout.set(`t = ${fmt(years, 4)} yr (${fmt(years / (2 * Math.PI / Math.pow(aJup, 1.5)), 3)} Jupiter orbits)`);
    }

    const loop = new Loop(step, render, 1 / 60);
    stage.onResize(() => loop.invalidate());
    histStage.onResize((w, h, d) => { hist.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.slider('Speed', { min: 50, max: 3000, value: s.yrPerSec, log: true, step: 1, unit: 'yr/s' }, (v) => (s.yrPerSec = v));
    panel.slider('Jupiter mass ×', { min: 0, max: 5, value: s.jupMass, step: 0.1 }, (v) => (s.jupMass = v));
    const readout = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
