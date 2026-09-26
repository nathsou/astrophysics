// Appendix A7: a 2D gas of hard discs. Particles start with identical speeds in random directions;
// elastic collisions shuffle energy between them until the speed histogram relaxes to the 2D
// Maxwell–Boltzmann distribution f(v) = (m v / kT) exp(−m v² / 2kT). Wall impulses give the
// pressure, compared with the ideal-gas law P A = N k T.
//
// Sim units: box = 1 × 1, particle mass = 1. Real speeds (m/s) map to sim speeds by VSCALE.
// Collisions: uniform grid (cell ≥ one diameter), counting sort each substep, O(N).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const KB = 1.380649e-23;
const AMU = 1.66053906660e-27;
const VSCALE = 1 / 1000; // 1000 m/s ↦ 1 box per second on screen
const R = 0.0065; // disc radius (box units)
const NMAX = 600;
const NB = 36; // histogram bins

type Species = 'he' | 'ar' | 'xe';
const SPECIES: Record<Species, { label: string; A: number }> = {
  he: { label: 'Helium (4 u)', A: 4.0 },
  ar: { label: 'Argon (40 u)', A: 39.95 },
  xe: { label: 'Xenon (131 u)', A: 131.3 },
};

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const boxStage = createStage(wrap, { aspect: 1 });
    const histStage = createStage(wrap, { aspect: 1 });
    const ctx = boxStage.canvas.getContext('2d')!;
    const plot = new Plot(histStage.canvas, {
      x: { min: 0, max: 1000, label: 'speed (m/s)' },
      y: { min: 0, max: 1, label: 'fraction per m/s (×10⁻³)' },
      title: 'Speed distribution',
    });

    let N = 300, T = 300, species: Species = 'ar';
    const px = new Float64Array(NMAX), py = new Float64Array(NMAX), vx = new Float64Array(NMAX), vy = new Float64Array(NMAX);
    const hist = new Float64Array(NB);
    let histW = 0;
    // pressure accumulator: impulse on walls and elapsed time, with exponential forgetting
    let impulse = 0, impT = 0;
    // tracer trail
    const TR = 400; const trX = new Float32Array(TR), trY = new Float32Array(TR); let trH = 0, trN = 0;

    const mass = () => SPECIES[species].A * AMU;
    const sigmaV = () => Math.sqrt((KB * T) / mass()); // m/s; the 2D most probable speed
    const vFrom = (u: number) => u / VSCALE; // sim → m/s

    function reset() {
      // Place on a jittered lattice (no overlaps), all with the same speed = 2D rms speed.
      const side = Math.ceil(Math.sqrt(N));
      const vs = Math.sqrt(2) * sigmaV() * VSCALE;
      for (let i = 0; i < N; i++) {
        const gx = i % side, gy = Math.floor(i / side);
        px[i] = (gx + 0.5 + (Math.random() - 0.5) * 0.3) / side;
        py[i] = (gy + 0.5 + (Math.random() - 0.5) * 0.3) / side;
        const a = Math.random() * 2 * Math.PI;
        vx[i] = vs * Math.cos(a); vy[i] = vs * Math.sin(a);
      }
      hist.fill(0); histW = 0; impulse = 0; impT = 0; trH = 0; trN = 0;
    }

    function setTemperature(Tn: number) {
      // velocity rescaling: multiply every speed by √(T_new / T_old)
      const f = Math.sqrt(Tn / T);
      for (let i = 0; i < N; i++) { vx[i] *= f; vy[i] *= f; }
      T = Tn; hist.fill(0); histW = 0; impulse = 0; impT = 0;
    }

    // --- collisions via a uniform grid ---
    const G = Math.floor(1 / (2 * R)); // cells per side, each ≥ one diameter
    const cellCount = new Int32Array(G * G), cellStart = new Int32Array(G * G + 1), sorted = new Int32Array(NMAX), cellOf = new Int32Array(NMAX);

    function collide() {
      cellCount.fill(0);
      for (let i = 0; i < N; i++) {
        const cx = Math.min(G - 1, Math.max(0, Math.floor(px[i] * G))), cy = Math.min(G - 1, Math.max(0, Math.floor(py[i] * G)));
        cellOf[i] = cy * G + cx; cellCount[cellOf[i]]++;
      }
      cellStart[0] = 0;
      for (let c = 0; c < G * G; c++) cellStart[c + 1] = cellStart[c] + cellCount[c];
      cellCount.fill(0);
      for (let i = 0; i < N; i++) { const c = cellOf[i]; sorted[cellStart[c] + cellCount[c]++] = i; }

      const d2 = 4 * R * R;
      for (let i = 0; i < N; i++) {
        const c = cellOf[i], cx = c % G, cy = (c / G) | 0;
        for (let oy = -1; oy <= 1; oy++) {
          const yy = cy + oy; if (yy < 0 || yy >= G) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = cx + ox; if (xx < 0 || xx >= G) continue;
            const cc = yy * G + xx;
            for (let k = cellStart[cc]; k < cellStart[cc + 1]; k++) {
              const j = sorted[k];
              if (j <= i) continue;
              const dx = px[j] - px[i], dy = py[j] - py[i];
              const r2 = dx * dx + dy * dy;
              if (r2 >= d2 || r2 === 0) continue;
              const dvx = vx[j] - vx[i], dvy = vy[j] - vy[i];
              const dot = dvx * dx + dvy * dy;
              if (dot >= 0) continue; // already separating
              // equal masses, elastic: swap the velocity components along the line of centres
              const s = dot / r2;
              vx[i] += s * dx; vy[i] += s * dy;
              vx[j] -= s * dx; vy[j] -= s * dy;
            }
          }
        }
      }
    }

    function step(h: number) {
      let vmax = 0;
      for (let i = 0; i < N; i++) vmax = Math.max(vmax, Math.abs(vx[i]) + Math.abs(vy[i]));
      const nsub = Math.min(12, Math.max(1, Math.ceil((vmax * h) / (0.6 * R))));
      const dt = h / nsub;
      for (let s = 0; s < nsub; s++) {
        for (let i = 0; i < N; i++) {
          px[i] += vx[i] * dt; py[i] += vy[i] * dt;
          if (px[i] < R) { px[i] = 2 * R - px[i]; if (vx[i] < 0) { impulse += -2 * vx[i]; vx[i] = -vx[i]; } }
          else if (px[i] > 1 - R) { px[i] = 2 * (1 - R) - px[i]; if (vx[i] > 0) { impulse += 2 * vx[i]; vx[i] = -vx[i]; } }
          if (py[i] < R) { py[i] = 2 * R - py[i]; if (vy[i] < 0) { impulse += -2 * vy[i]; vy[i] = -vy[i]; } }
          else if (py[i] > 1 - R) { py[i] = 2 * (1 - R) - py[i]; if (vy[i] > 0) { impulse += 2 * vy[i]; vy[i] = -vy[i]; } }
        }
        collide();
      }
      impT += h;
      // forget old pressure data on a ~3 s timescale
      const f = Math.exp(-h / 3); impulse *= f; impT *= f;

      trX[trH] = px[0]; trY[trH] = py[0]; trH = (trH + 1) % TR; trN = Math.min(trN + 1, TR);
    }

    function accumulate() {
      const vmaxH = 4 * sigmaV();
      for (let b = 0; b < NB; b++) hist[b] *= 0.97;
      histW *= 0.97;
      for (let i = 0; i < N; i++) {
        const v = vFrom(Math.hypot(vx[i], vy[i]));
        const b = Math.floor((v / vmaxH) * NB);
        if (b < NB) hist[b]++;
        histW++;
      }
    }

    function render() {
      const { width: W, dpr } = boxStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);
      const pad = 6, S = W - 2 * pad;
      ctx.strokeStyle = pal.axis; ctx.lineWidth = 1.5;
      ctx.strokeRect(pad, pad, S, S);
      const sp = sigmaV() * VSCALE;
      const rr = Math.max(1.6, R * S);
      // tracer path
      ctx.strokeStyle = pal.accent2; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
      ctx.beginPath();
      const st = (trH - trN + TR) % TR;
      for (let k = 0; k < trN; k++) {
        const j = (st + k) % TR;
        const X = pad + trX[j] * S, Y = pad + (1 - trY[j]) * S;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      // particles coloured by speed: slow / typical / fast
      const cols = [pal.series[0], pal.muted, pal.accent];
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = cols[c];
        ctx.beginPath();
        for (let i = 1; i < N; i++) {
          const u = Math.hypot(vx[i], vy[i]) / sp;
          const cls = u < 0.7 ? 0 : u < 1.8 ? 1 : 2;
          if (cls !== c) continue;
          const X = pad + px[i] * S, Y = pad + (1 - py[i]) * S;
          ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.fillStyle = pal.accent2;
      ctx.beginPath(); ctx.arc(pad + px[0] * S, pad + (1 - py[0]) * S, rr + 1.5, 0, Math.PI * 2); ctx.fill();

      // histogram vs theory
      if (!loop.paused) accumulate();
      const vmaxH = 4 * sigmaV(), bw = vmaxH / NB;
      plot.o.x.max = vmaxH;
      const m = mass(), kT = KB * T;
      const f = (v: number) => ((m * v) / kT) * Math.exp((-m * v * v) / (2 * kT));
      const peak = f(sigmaV()) * 1e3;
      plot.o.y.max = peak * 1.35;
      plot.draw(() => {
        const c = plot.ctx;
        c.fillStyle = pal.series[0]; c.globalAlpha = 0.55;
        for (let b = 0; b < NB; b++) {
          const y = histW > 0 ? (hist[b] / (histW * bw)) * 1e3 : 0;
          const x0 = plot.px(b * bw), x1 = plot.px((b + 1) * bw);
          c.fillRect(x0 + 0.5, plot.py(y), Math.max(1, x1 - x0 - 1), plot.py(0) - plot.py(y));
        }
        c.globalAlpha = 1;
        plot.fn((v) => f(v) * 1e3, { color: pal.accent, width: 2 });
        plot.vline(sigmaV(), { color: pal.muted, label: 'v_p' });
      });

      // readouts
      let ke = 0;
      for (let i = 0; i < N; i++) ke += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i]);
      const kTsim = ke / N; // 2D: <KE> = kT
      rT.set(`${fmt((kTsim / (VSCALE * VSCALE)) * (m / KB), 4)} K`);
      rV.set(`${fmt(sigmaV(), 3)} m/s`);
      const Pmeas = impT > 0 ? impulse / impT / 4 : 0; // per unit wall length (perimeter 4)
      const Pideal = (N * kTsim) / 1; // area 1
      rP.set(impT > 1 ? fmt(Pmeas / Pideal, 3) : '…');
    }

    const loop = new Loop(step, render, 1 / 120);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    boxStage.onResize(() => loop.invalidate());
    histStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('Temperature', { min: 20, max: 1200, value: T, log: true, step: 1, unit: 'K' }, (v) => { setTemperature(v); loop.invalidate(); });
    panel.select<Species>('Gas', (Object.keys(SPECIES) as Species[]).map((k) => ({ value: k, label: SPECIES[k].label })), species, (v) => { species = v; reset(); loop.invalidate(); });
    panel.slider('Particles', { min: 50, max: NMAX, value: N, step: 10, format: (v) => String(Math.round(v)) }, (v) => { N = Math.round(v); reset(); loop.invalidate(); });
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset (equal speeds)', () => { reset(); loop.invalidate(); });
    const rT = panel.readout('T from ⟨KE⟩');
    const rV = panel.readout('v_p');
    const rP = panel.readout('P / (NkT/A)');

    reset();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
