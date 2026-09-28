// Appendix A9: quantum tunnelling through a rectangular barrier.
// The time-independent Schrödinger equation is solved exactly, region by region: in each
// region ψ = C e^{ikx} + D e^{-ikx} with k = √(2m(E−V))/ħ, which is imaginary (k = iκ)
// inside a barrier taller than E. Matching ψ and ψ' at each edge, working backwards from a
// pure transmitted wave, gives the reflection and transmission amplitudes.
// Top: the potential and the wavefunction (animated as Re ψ e^{-iωt}). Bottom: T versus width.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { narrowAspect } from './primer-common/stack';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

// ħ²/2m in eV·nm²
const H2M: Record<'e' | 'p', number> = { e: 0.0380998, p: 0.0380998 / 1836.15 };

type Cx = [number, number];
const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cadd = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
const csub = (a: Cx, b: Cx): Cx => [a[0] - b[0], a[1] - b[1]];
const cdiv = (a: Cx, b: Cx): Cx => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cexp = (z: Cx): Cx => { const m = Math.exp(z[0]); return [m * Math.cos(z[1]), m * Math.sin(z[1])]; };
const I: Cx = [0, 1];

/** Wavenumber in a region: real k if E > V, imaginary iκ if E < V. */
function kOf(E: number, V: number, h2m: number): Cx {
  const d = (E - V) / h2m;
  if (Math.abs(d) < 1e-9) return [1e-4, 0];
  return d > 0 ? [Math.sqrt(d), 0] : [0, Math.sqrt(-d)];
}

/** Given (C, D) on the right of an interface at x0, find (C, D) on the left so ψ and ψ' match. */
function matchLeft(x0: number, kL: Cx, kR: Cx, C: Cx, D: Cx): [Cx, Cx] {
  const eR = cexp(cmul(I, cmul(kR, [x0, 0]))), eRm = cdiv([1, 0], eR);
  const psi = cadd(cmul(C, eR), cmul(D, eRm));
  const dpsi = cmul(cmul(I, kR), csub(cmul(C, eR), cmul(D, eRm)));
  const q = cdiv(dpsi, cmul(I, kL)); // ψ'/(i k_L)
  const eL = cexp(cmul(I, cmul(kL, [x0, 0]))), eLm = cdiv([1, 0], eL);
  const CL = cmul(cmul(cadd(psi, q), [0.5, 0]), eLm);
  const DL = cmul(cmul(csub(psi, q), [0.5, 0]), eL);
  return [CL, DL];
}

/** Exact transmission probability of a rectangular barrier (closed form; underflows gracefully). */
export function transmission(E: number, V0: number, a: number, h2m: number): number {
  if (Math.abs(E - V0) < 1e-9) return 1 / (1 + (a * a * V0) / (4 * h2m));
  if (E < V0) {
    const ka = Math.sqrt((V0 - E) / h2m) * a;
    if (ka > 350) return 0;
    const sh = Math.sinh(ka);
    return 1 / (1 + (V0 * V0 * sh * sh) / (4 * E * (V0 - E)));
  }
  const sn = Math.sin(Math.sqrt((E - V0) / h2m) * a);
  return 1 / (1 + (V0 * V0 * sn * sn) / (4 * E * (E - V0)));
}

interface Solution { k: Cx; kb: Cx; A: [Cx, Cx]; B: [Cx, Cx]; Ct: Cx; T: number; aEff: number }

function solve(E: number, V0: number, aIn: number, h2m: number): Solution {
  const k = kOf(E, 0, h2m), kb = kOf(E, V0, h2m);
  // For a very opaque barrier the backward matching would overflow (e^{κa}); the transmitted
  // wave is invisibly small anyway, so solve for a barrier cut at κa = 200 and zero ψ beyond it.
  const a = kb[1] > 0 ? Math.min(aIn, 200 / kb[1]) : aIn;
  // right region: pure outgoing wave, amplitude 1 (normalised below)
  const [Cb, Db] = matchLeft(a, kb, k, [1, 0], [0, 0]);
  const [C0, D0] = matchLeft(0, k, kb, Cb, Db);
  // normalise so the incident amplitude is 1
  const n = cdiv([1, 0], C0);
  const A: [Cx, Cx] = [[1, 0], cmul(D0, n)];
  const B: [Cx, Cx] = [cmul(Cb, n), cmul(Db, n)];
  const Ct = n;
  return { k, kb, A, B, Ct: a < aIn ? [0, 0] : Ct, T: transmission(E, V0, aIn, h2m), aEff: a };
}

function psiAt(s: Solution, x: number, a: number): Cx {
  if (s.aEff < a && x > s.aEff) return [0, 0];
  const [C, D, k]: [Cx, Cx, Cx] = x < 0 ? [s.A[0], s.A[1], s.k] : x <= a ? [s.B[0], s.B[1], s.kb] : [s.Ct, [0, 0], s.k];
  const e = cexp(cmul(I, cmul(k, [x, 0])));
  return cadd(cmul(C, e), cmul(D, cdiv([1, 0], e)));
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const top = createStage(host, { aspect: 2.4 });

    narrowAspect(top, 2.4, 1.5);
    const bot = createStage(host, { aspect: 3.2 });
    narrowAspect(bot, 3.2, 1.7);
    bot.el.style.borderTop = '1px solid var(--rule)';
    const ctx = top.canvas.getContext('2d')!;
    const tplot = new Plot(bot.canvas, {
      x: { min: 0, max: 2, label: 'barrier width a (nm)' },
      y: { min: 1e-12, max: 1.5, log: true, label: 'T' },
      title: 'Transmission probability vs width',
    });

    let E = 1, V0 = 3, a = 0.5; // eV, eV, nm
    let particle: 'e' | 'p' = 'e';
    let t = 0;
    let sol = solve(E, V0, a, H2M[particle]);

    const loop = new Loop((dt) => { t += dt; }, render, 1 / 60);

    function render() {
      const { width: W, height: H, dpr } = top;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // x range: from -2 nm to a + 2 nm
      const xmin = -2, xmax = Math.max(a, 0.2) + 2;
      const X = (x: number) => 10 + ((x - xmin) / (xmax - xmin)) * (W - 20);
      const Emax = Math.max(V0, E) * 1.35 + 0.2;
      const yb = H - 22, ytop = 12;
      const Y = (e: number) => yb - (e / Emax) * (yb - ytop);
      // barrier
      ctx.fillStyle = pal.grid;
      ctx.fillRect(X(0), Y(V0), X(a) - X(0), yb - Y(V0));
      ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(xmin), yb); ctx.lineTo(X(0), yb); ctx.lineTo(X(0), Y(V0)); ctx.lineTo(X(a), Y(V0)); ctx.lineTo(X(a), yb); ctx.lineTo(X(xmax), yb); ctx.stroke();
      // energy line
      ctx.strokeStyle = pal.faint; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(X(xmin), Y(E)); ctx.lineTo(X(xmax), Y(E)); ctx.stroke(); ctx.setLineDash([]);
      // wavefunction drawn around the energy line; amplitude scaled so the incident wave has height amp
      const amp = Math.min((yb - ytop) * 0.18, Y(0) - Y(E) + 20);
      const w = 2 * Math.PI * 0.6; // display angular frequency (the real ω is ~10¹⁵ s⁻¹)
      const rot = cexp([0, -w * t]);
      const M = 600;
      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const x = xmin + ((xmax - xmin) * i) / M;
        const p = psiAt(sol, x, a);
        const m = Math.hypot(p[0], p[1]);
        const yy = Y(E) - (amp * m) / 2;
        i ? ctx.lineTo(X(x), yy) : ctx.moveTo(X(x), yy);
      }
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const x = xmin + ((xmax - xmin) * i) / M;
        const p = cmul(psiAt(sol, x, a), rot);
        const yy = Y(E) - (amp * p[0]) / 2;
        i ? ctx.lineTo(X(x), yy) : ctx.moveTo(X(x), yy);
      }
      ctx.strokeStyle = pal.accent2; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.muted; ctx.textAlign = 'left';
      // Energy label under the dashed line on the transmitted side, where |ψ| ≤ 1 keeps it clear of the wave.
      ctx.textAlign = 'right';
      ctx.fillText(`E = ${fmt(E, 3)} eV`, X(xmax) - 4, Math.min(yb - 6, Y(E) + amp / 2 + 16));
      ctx.textAlign = 'center';
      ctx.fillText(`V₀ = ${fmt(V0, 3)} eV`, (X(0) + X(a)) / 2, Y(V0) - 6);
      ctx.fillStyle = pal.accent; ctx.textAlign = 'right';
      ctx.fillText('|ψ|', X(xmax) - 4, 14);
      ctx.fillStyle = pal.accent2;
      ctx.fillText('Re ψ', X(xmax) - 4, 28);

      // bottom: T(a)
      tplot.o.x.max = Math.max(2, a * 1.5);
      tplot.draw(() => {
        const h2m = H2M[particle];
        tplot.fn((aa) => transmission(E, V0, aa, h2m), { color: pal.accent, samples: 240 });
        if (E < V0) {
          const kap = Math.sqrt((V0 - E) / h2m);
          tplot.fn((aa) => 16 * (E / V0) * (1 - E / V0) * Math.exp(-2 * kap * aa), { color: pal.faint, dash: [4, 4], width: 1.2, samples: 120 });
        }
        tplot.point(a, Math.max(sol.T, 1e-12), { r: 5, color: pal.accent2, stroke: pal.fg });
      });
    }

    function update() {
      sol = solve(E, V0, a, H2M[particle]);
      rT.set(fmt(sol.T, 3));
      if (E < V0) {
        const kap = Math.sqrt((V0 - E) / H2M[particle]);
        rk.set(`${fmt(1 / kap, 3)} nm`);
      } else rk.set('— (E > V₀: over the top)');
      loop.invalidate();
    }

    top.onResize(() => loop.invalidate());
    bot.onResize((w, h, d) => { tplot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.select<'e' | 'p'>('Particle', [
      { value: 'e', label: 'Electron' },
      { value: 'p', label: 'Proton (1836× heavier)' },
    ], particle, (v) => { particle = v; update(); });
    panel.slider('Energy E', { min: 0.05, max: 8, value: E, step: 0.01, unit: 'eV' }, (v) => { E = v; update(); });
    panel.slider('Barrier height V₀', { min: 0.1, max: 8, value: V0, step: 0.01, unit: 'eV' }, (v) => { V0 = v; update(); });
    panel.slider('Barrier width a', { min: 0.02, max: 3, value: a, step: 0.01, unit: 'nm' }, (v) => { a = v; update(); });
    const rT = panel.readout('Transmission T =');
    const rk = panel.readout('Decay length 1/κ =');
    update();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
