// Chapter 28: the 1D Zel'dovich approximation. Particles at Lagrangian positions q move to
// x = q + D ψ(q). Top: phase space (x, velocity ∝ ψ). Bottom: density, measured and 1/|1 + D ψ'|.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { rng } from './structure/cosmo';

const NP = 1200, NB = 150, MODES = 4;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const psStage = createStage(host, { aspect: 2.6 });
    const rhoStage = createStage(host, { aspect: 3.4 });
    const ps = new Plot(psStage.canvas, {
      x: { min: 0, max: 1, label: '' }, y: { min: -1, max: 1, label: 'velocity' },
      title: 'Phase space: position x vs velocity',
    });
    const rp = new Plot(rhoStage.canvas, {
      x: { min: 0, max: 1, label: 'comoving position x (box units)' }, y: { min: 0.05, max: 50, log: true, label: 'ρ / ρ̄' },
    });

    let D = 0, seed = 5, playing = false;
    const amp = new Float64Array(MODES), phase = new Float64Array(MODES);
    let norm = 1;
    const psi = (q: number) => { let s = 0; for (let m = 0; m < MODES; m++) s += amp[m] * Math.sin(2 * Math.PI * (m + 1) * q + phase[m]); return s * norm; };
    const dpsi = (q: number) => { let s = 0; for (let m = 0; m < MODES; m++) s += amp[m] * 2 * Math.PI * (m + 1) * Math.cos(2 * Math.PI * (m + 1) * q + phase[m]); return s * norm; };
    function newField() {
      const r = rng(seed);
      for (let m = 0; m < MODES; m++) { amp[m] = r.gauss() / (m + 1) ** 1.5; phase[m] = 2 * Math.PI * r.u(); }
      // normalise so the steepest compression (min ψ') is −1: the first shell crossing happens at D = 1
      norm = 1;
      let mn = 0;
      for (let i = 0; i < 2000; i++) mn = Math.min(mn, dpsi(i / 2000));
      norm = 1 / -mn;
      let mx = 0;
      for (let i = 0; i < 2000; i++) mx = Math.max(mx, Math.abs(psi(i / 2000)));
      ps.o.y.min = -mx * 1.15; ps.o.y.max = mx * 1.15;
    }
    newField();

    const xs = new Float64Array(NP), vs = new Float64Array(NP);
    const hist = new Float64Array(NB), hx = new Float64Array(NB);
    for (let b = 0; b < NB; b++) hx[b] = (b + 0.5) / NB;

    const loop = new Loop((dt) => {
      if (!playing) return;
      D += dt * 0.35;
      if (D > 2.5) D = 0;
      dCtl.set(D);
    }, render, 1 / 60);

    const wrap = (x: number) => x - Math.floor(x);
    function render() {
      hist.fill(0);
      for (let i = 0; i < NP; i++) {
        const q = (i + 0.5) / NP;
        xs[i] = wrap(q + D * psi(q)); vs[i] = psi(q);
        hist[Math.min(NB - 1, Math.floor(xs[i] * NB))] += NB / NP;
      }
      let streams = 1;
      for (let i = 0; i < 400; i++) if (1 + D * dpsi(i / 400) < 0) { streams = 3; break; }
      ps.draw(() => {
        // the sheet, drawn in q order so folds are visible
        const c = ps.ctx;
        c.strokeStyle = pal.faint; c.lineWidth = 1; c.beginPath();
        for (let i = 0; i < NP; i++) {
          const X = ps.px(xs[i]), Y = ps.py(vs[i]);
          if (i && Math.abs(xs[i] - xs[i - 1]) > 0.5) c.moveTo(X, Y); else if (i) c.lineTo(X, Y); else c.moveTo(X, Y);
        }
        c.stroke();
        ps.scatter(xs, vs, { size: 2, color: (i) => (1 + D * dpsi((i + 0.5) / NP) < 0 ? pal.bad : pal.accent) });
        ps.text(`D = ${fmt(D, 3)}${streams > 1 ? '  ·  shells have crossed: multi-stream region (red)' : ''}`, ps.m.l + 8, ps.m.t + 14, { color: pal.fg });
      });
      rp.draw(() => {
        rp.line(hx, hist, { color: pal.series[1], width: 1.5 });
        // Zel'dovich density of the single-stream map (sum over streams omitted): 1/|1 + D ψ'|
        rp.fn((x) => 1 / Math.abs(1 + D * dpsi(x)), { color: pal.accent, width: 1, alpha: 0.7, samples: 800 });
        rp.hline(1, { color: pal.faint, dash: [3, 3] });
      });
    }
    psStage.onResize((w, h, d) => { ps.resize(w, h, d); loop.invalidate(); });
    rhoStage.onResize((w, h, d) => { rp.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    const pb = panel.button('▶ Play', () => { playing = !playing; pb.textContent = playing ? '❚❚ Pause' : '▶ Play'; });
    const dCtl = panel.slider('Growth D', { min: 0, max: 2.5, value: D, step: 0.005 }, (v) => { D = v; loop.invalidate(); });
    panel.button('New field', () => { seed = (seed * 16807) % 2147483647; newField(); loop.invalidate(); });
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
