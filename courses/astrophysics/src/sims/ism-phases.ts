// Chapter 6 flagship: a toy 2D "ISM ecosystem". A gas grid with pressure forces, semi-Lagrangian
// advection and a tabulated heating/cooling source term. Click (or let the rate slider) fire
// supernovae that blow hot, low-density bubbles; the swept-up shells cool and pile up into dense,
// cold clumps, while the background settles between the warm and hot phases. A live n–T phase
// diagram shows the gas clustering on the thermal-equilibrium curve from ism-pressure.ts.
//
// This is a heavily simplified toy, NOT a hydro code: no shock capturing, no self-gravity, no
// magnetic fields, a periodic box, and an explicit, capped-subcycle cooling step. See the <Hood>
// in the chapter for what real codes (TIGRESS, SILCC) do differently. See src/sims/ism/cooling.ts
// for the shared heating/cooling table also used by ism-pressure.ts.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { dTdt, thermalTimescale, equilibriumT, equilibriumCurve as eqCurveT } from './ism/cooling';

const N = 100; // grid resolution (N×N)
const L_PC = 220; // box size
const PC_CM = 3.0857e18;
const DX_CM = (L_PC / N) * PC_CM;
const MP_G = 1.67262192369e-24; // proton mass, g
const KB_ERG = 1.380649e-16;
const YR_S = 3.156e7;
const N_FLOOR = 1e-3, T_FLOOR = 8, T_CEIL = 5e7;
const VMAX = 5e7; // cm/s ≈ 500 km/s, a generous cap on the explicit advection speed

const idxWrap = (x: number, y: number) => ((y % N + N) % N) * N + ((x % N + N) % N);

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : 'minmax(0,1.35fr) minmax(0,1fr)'}`;
    host.append(wrap);
    const gasStage = createStage(wrap, { aspect: 1 });
    const phaseStage = createStage(wrap, { aspect: 1 / 0.92 });
    gasStage.el.style[narrow ? 'borderBottom' : 'borderRight'] = '1px solid var(--rule)';
    const gasCtx = gasStage.canvas.getContext('2d')!;

    const off = document.createElement('canvas');
    off.width = N; off.height = N;
    const offCtx = off.getContext('2d')!;
    const img = offCtx.createImageData(N, N);

    const phase = new Plot(phaseStage.canvas, {
      x: { min: 1e-3, max: 1e4, log: true, label: 'n (cm⁻³)' },
      y: { min: 10, max: 3e7, log: true, label: 'T (K)' },
      title: 'Phase diagram',
    });

    // --- state (double-buffered for the advection swap) ---
    let n = new Float32Array(N * N).fill(1);
    let T = new Float32Array(N * N).fill(8000);
    let vx = new Float32Array(N * N);
    let vy = new Float32Array(N * N);
    let n2 = new Float32Array(N * N), T2 = new Float32Array(N * N), vx2 = new Float32Array(N * N), vy2 = new Float32Array(N * N);
    const ax = new Float32Array(N * N), ay = new Float32Array(N * N);

    let logGamma = Math.log10(1.7e-26), Z = 1, snRatePerMyr = 0.5, view: 'temp' | 'density' = 'temp';
    let simMyr = 0;
    let frac = { cold: 0, warm: 0, hot: 0 };

    const MODES: [number, number, number, number][] = [];
    function seed() {
      MODES.length = 0;
      for (let k = 0; k < 7; k++) MODES.push([Math.floor(Math.random() * 7) - 3, Math.floor(Math.random() * 7) - 3, Math.random() * 6.283, 0.28 * Math.random()]);
      n.fill(0); T.fill(0);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        // Mild turbulent-ish density fluctuations around n≈1, T set to the WNM equilibrium.
        // a few random periodic Fourier modes: a lumpy, turbulent-looking start rather than a lattice
        let noise = 1;
        for (const [kx, ky, ph, a] of MODES) noise += a * Math.sin((2 * Math.PI * (kx * x + ky * y)) / N + ph);
        n[i] = Math.max(N_FLOOR, 1.2 * noise); // mean ≈ 1.2 cm⁻³: straddles the unstable range (n ≈ 1–10)
        T[i] = equilibriumT(n[i], 10 ** logGamma, Z);
      }
      vx.fill(0); vy.fill(0);
      simMyr = 0;
      loop.invalidate();
    }

    function injectSN(cx: number, cy: number) {
      const Rsn = 6; // cells
      for (let dy = -Rsn; dy <= Rsn; dy++) for (let dx = -Rsn; dx <= Rsn; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > Rsn) continue;
        const i = idxWrap(cx + dx, cy + dy);
        const f = 1 - d / Rsn;
        T[i] = Math.min(T_CEIL, T[i] + 4e6 * f * f);
        n[i] = Math.max(N_FLOOR, n[i] * (1 - 0.85 * f));
        const vkick = 3e6 * f; // cm/s
        const inv = d > 0.3 ? vkick / d : 0;
        vx[i] += dx * inv; vy[i] += dy * inv;
      }
      loop.invalidate();
    }

    function computeAccel() {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const pR = n[idxWrap(x + 1, y)] * T[idxWrap(x + 1, y)];
        const pL = n[idxWrap(x - 1, y)] * T[idxWrap(x - 1, y)];
        const pU = n[idxWrap(x, y + 1)] * T[idxWrap(x, y + 1)];
        const pD = n[idxWrap(x, y - 1)] * T[idxWrap(x, y - 1)];
        const coeff = -KB_ERG / (MP_G * Math.max(n[i], N_FLOOR) * 2 * DX_CM);
        ax[i] = coeff * (pR - pL);
        ay[i] = coeff * (pU - pD);
      }
    }

    function sample(field: Float32Array, px: number, py: number): number {
      const x0 = Math.floor(px), y0 = Math.floor(py);
      const fx = px - x0, fy = py - y0;
      const v00 = field[idxWrap(x0, y0)], v10 = field[idxWrap(x0 + 1, y0)];
      const v01 = field[idxWrap(x0, y0 + 1)], v11 = field[idxWrap(x0 + 1, y0 + 1)];
      return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }

    function stepPhysics(dtSub: number) {
      computeAccel();
      // kick (with a small speed cap — this is an explicit scheme; a real hydro code would use a
      // Riemann solver and a CFL-limited timestep instead of a hard velocity clamp)
      for (let i = 0; i < N * N; i++) {
        let vxi = vx[i] + ax[i] * dtSub, vyi = vy[i] + ay[i] * dtSub;
        const sp = Math.hypot(vxi, vyi);
        if (sp > VMAX) { vxi *= VMAX / sp; vyi *= VMAX / sp; }
        vx[i] = vxi; vy[i] = vyi;
      }
      // semi-Lagrangian advection: unconditionally stable regardless of CFL, at the cost of
      // numerical diffusion (see the <Hood> for the trade-off).
      const cellPerS = dtSub / DX_CM;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const px = x - vx[i] * cellPerS, py = y - vy[i] * cellPerS;
        n2[i] = Math.max(N_FLOOR, sample(n, px, py));
        T2[i] = Math.min(T_CEIL, Math.max(T_FLOOR, sample(T, px, py)));
        vx2[i] = sample(vx, px, py) * 0.9995; // weak drag (e-folding ~6 Myr) to bleed grid-scale noise
        vy2[i] = sample(vy, px, py) * 0.9995;
      }
      [n, n2] = [n2, n]; [T, T2] = [T2, T]; [vx, vx2] = [vx2, vx]; [vy, vy2] = [vy2, vy];
      // Semi-Lagrangian transport alone only carries n and T along the flow (Dn/Dt = 0); add the
      // compression terms of the continuity and energy equations, Dn/Dt = −n∇·v and
      // DT/Dt = −(γ−1)T∇·v, so converging flows actually build dense clumps (and heat adiabatically).
      const invDx = dtSub / (2 * DX_CM);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const divDt = (vx[idxWrap(x + 1, y)] - vx[idxWrap(x - 1, y)] + vy[idxWrap(x, y + 1)] - vy[idxWrap(x, y - 1)]) * invDx;
        const f = Math.min(1.5, Math.max(0.67, Math.exp(-divDt)));
        n2[i] = Math.max(N_FLOOR, n[i] * f);
        T2[i] = Math.min(T_CEIL, Math.max(T_FLOOR, T[i] * f ** (2 / 3)));
      }
      [n, n2] = [n2, n]; [T, T2] = [T2, T];
      // operator-split cooling: a stiff local ODE, integrated with an adaptive number of
      // sub-steps per cell (capped, for a bounded worst-case cost — see the <Hood>).
      const Gamma = 10 ** logGamma;
      for (let i = 0; i < N * N; i++) {
        const tau = thermalTimescale(n[i], T[i], Gamma, Z);
        const nsub = Math.min(24, Math.max(1, Math.ceil(dtSub / (0.25 * tau))));
        const h = dtSub / nsub;
        let Ti = T[i];
        for (let k = 0; k < nsub; k++) Ti = Math.min(T_CEIL, Math.max(T_FLOOR, Ti + dTdt(n[i], Ti, Gamma, Z) * h));
        T[i] = Ti;
      }
      simMyr += dtSub / (YR_S * 1e6);
    }

    // --- supernova scheduling ---
    let snAccumulator = 0;
    function maybeSpawnSN(dtMyr: number) {
      snAccumulator += snRatePerMyr * dtMyr;
      while (snAccumulator >= 1) {
        snAccumulator -= 1;
        // density-weighted placement: OB stars form preferentially in denser gas
        let cx = 0, cy = 0;
        for (let tries = 0; tries < 8; tries++) {
          cx = Math.floor(Math.random() * N); cy = Math.floor(Math.random() * N);
          if (Math.random() < Math.min(1, n[cy * N + cx] / 3)) break;
        }
        injectSN(cx, cy);
      }
    }

    function tempColor(logT: number): [number, number, number] {
      // cold → warm → hot colour ramp (not a physical blackbody — chosen for contrast).
      const stops: [number, number, number, number][] = [
        [1.3, 10, 20, 60], [2.2, 40, 60, 160], [3.3, 60, 140, 200],
        [3.9, 120, 200, 140], [4.3, 230, 200, 70], [5.2, 240, 110, 40], [6.5, 255, 240, 220],
      ];
      let t = logT;
      if (t <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
      for (let k = 1; k < stops.length; k++) {
        if (t <= stops[k][0]) {
          const [t0, r0, g0, b0] = stops[k - 1], [, r1, g1, b1] = stops[k];
          const f = (t - t0) / (stops[k][0] - t0);
          return [r0 + f * (r1 - r0), g0 + f * (g1 - g0), b0 + f * (b1 - b0)];
        }
      }
      const last = stops[stops.length - 1];
      return [last[1], last[2], last[3]];
    }
    function densityColor(logN: number): [number, number, number] {
      const f = Math.max(0, Math.min(1, (logN + 2) / 4.5));
      return [20 + f * 30, 40 + f * 120, 70 + f * 170];
    }

    function drawGas() {
      const data = img.data;
      let cold = 0, warm = 0, hot = 0;
      for (let i = 0; i < N * N; i++) {
        const [r, g, b] = view === 'temp' ? tempColor(Math.log10(T[i])) : densityColor(Math.log10(n[i]));
        data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
        if (T[i] < 300) cold++; else if (T[i] < 2e4) warm++; else hot++;
      }
      frac = { cold: cold / (N * N), warm: warm / (N * N), hot: hot / (N * N) };
      offCtx.putImageData(img, 0, 0);
      const { width: W, height: H, dpr } = gasStage;
      gasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gasCtx.imageSmoothingEnabled = true;
      gasCtx.clearRect(0, 0, W, H);
      gasCtx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      gasCtx.fillStyle = 'rgba(0,0,0,0.55)';
      gasCtx.fillRect(0, H - 20, W, 20);
      gasCtx.fillStyle = '#e8e8ee';
      gasCtx.font = '11px JetBrains Mono, ui-monospace, monospace';
      gasCtx.fillText(`t = ${fmt(simMyr, 3)} Myr   cold ${fmt(frac.cold * 100, 2)}%  warm ${fmt(frac.warm * 100, 2)}%  hot ${fmt(frac.hot * 100, 2)}%   box ${L_PC} pc`, 8, H - 6);
    }

    let eqCurve: { n: number[]; T: number[] } | null = null;
    let eqParamsKey = '';
    function equilibriumCurve() {
      const key = `${logGamma}:${Z}`;
      if (eqParamsKey === key && eqCurve) return eqCurve;
      eqParamsKey = key;
      const c = eqCurveT(10 ** logGamma, Z, 10, 3e7, 300);
      const nOut = Array.from(c.n), TOut = Array.from(c.T);
      eqCurve = { n: nOut, T: TOut };
      return eqCurve;
    }

    function drawPhase() {
      const eq = equilibriumCurve();
      phase.draw(() => {
        phase.line(eq.n, eq.T, { color: pal.muted, width: 1.5, dash: [4, 3] });
        for (let i = 0; i < N * N; i += 2) {
          const [r, g, b] = tempColor(Math.log10(T[i]));
          phase.point(Math.max(1e-3, n[i]), T[i], { r: 1.4, color: `rgba(${r | 0},${g | 0},${b | 0},0.55)` });
        }
      });
    }

    function render() {
      drawGas();
      drawPhase();
    }

    const loop = new Loop((dt) => {
      // dt is the fixed physics step (seconds of *real* time); convert to sim time via speed.
      // Each physics step is 3 kyr (the semi-Lagrangian advection is stable at any CFL, but the
      // explicit pressure kick is not); higher speeds take more steps per frame, lower ones fewer.
      stepAcc += speed;
      while (stepAcc >= 1) {
        stepAcc -= 1;
        const dtSub = 3000 * YR_S;
        stepPhysics(dtSub);
        maybeSpawnSN(dtSub / (YR_S * 1e6));
      }
    }, render, 1 / 60);
    let speed = 1, stepAcc = 0;

    gasStage.onResize(() => loop.invalidate());
    phaseStage.onResize((w, h, d) => { phase.resize(w, h, d); loop.invalidate(); });

    gasStage.canvas.style.touchAction = 'none';
    gasStage.canvas.addEventListener('pointerdown', (e) => {
      const r = gasStage.canvas.getBoundingClientRect();
      const cx = Math.floor(((e.clientX - r.left) / r.width) * N);
      const cy = Math.floor(((e.clientY - r.top) / r.height) * N);
      injectSN(cx, cy);
    });

    seed();

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', seed);
    panel.select('View', [{ value: 'temp', label: 'Temperature' }, { value: 'density', label: 'Density' }], view, (v) => { view = v as 'temp' | 'density'; loop.invalidate(); });
    panel.slider('SN rate', { min: 0, max: 2, value: snRatePerMyr, step: 0.05, format: (v) => `${fmt(v, 2)} / Myr` }, (v) => (snRatePerMyr = v));
    panel.slider('UV heating Γ', { min: -27, max: -25, value: logGamma, step: 0.02, format: (v) => `${fmt(10 ** v, 2)} erg/s` }, (v) => { logGamma = v; });
    panel.slider('Metallicity Z', { min: 0.1, max: 3, value: Z, log: true, step: 0.02, format: (v) => `${fmt(v, 2)}×Z☉` }, (v) => { Z = v; });
    panel.slider('Speed', { min: 0.25, max: 4, value: speed, log: true, step: 0.05, format: (v) => `${fmt(v, 2)}×` }, (v) => (speed = v));

    loop.setVisible(true);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
