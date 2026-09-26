// Secondary figure: 2D Rayleigh–Bénard convection. A coarse grid solves the Boussinesq
// equations (incompressible flow driven by buoyancy, vorticity-streamfunction form) with a
// stable semi-Lagrangian advection scheme. Heated from below, cooled from above; crank the
// temperature difference (a proxy for the Rayleigh number) past onset and cells appear.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const NX = 96;
const NY = 56;

function idx(x: number, y: number) { return y * NX + x; }

export default defineSim({
  mount({ host, onDestroy }) {
    const stage = createStage(host, { aspect: NX / NY, maxDpr: 2 });
    const ctx2 = stage.canvas.getContext('2d')!;
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    // Fields: T (temperature 0..1), vorticity w, streamfunction psi, velocity u,v
    const T = new Float64Array(NX * NY);
    const Tn = new Float64Array(NX * NY);
    const w = new Float64Array(NX * NY);
    const wn = new Float64Array(NX * NY);
    const psi = new Float64Array(NX * NY);
    const u = new Float64Array(NX * NY);
    const v = new Float64Array(NX * NY);
    const img = ctx2.createImageData(NX, NY);

    const s = { deltaT: 1.2, viscosity: 0.06, running: true };

    function initFields() {
      for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
        const frac = 1 - y / (NY - 1); // 1 at bottom (hot), 0 at top (cold)
        T[idx(x, y)] = frac + 0.01 * (Math.random() - 0.5);
        w[idx(x, y)] = 0; psi[idx(x, y)] = 0;
      }
    }
    initFields();

    // Jacobi relaxation for del^2 psi = -w with psi=0 on boundaries.
    function solvePoisson() {
      for (let it = 0; it < 24; it++) {
        for (let y = 1; y < NY - 1; y++) {
          for (let x = 1; x < NX - 1; x++) {
            const i = idx(x, y);
            psi[i] = 0.25 * (psi[idx(x - 1, y)] + psi[idx(x + 1, y)] + psi[idx(x, y - 1)] + psi[idx(x, y + 1)] + w[i]);
          }
        }
      }
    }

    function velocityFromPsi() {
      for (let y = 1; y < NY - 1; y++) {
        for (let x = 1; x < NX - 1; x++) {
          const i = idx(x, y);
          u[i] = (psi[idx(x, y + 1)] - psi[idx(x, y - 1)]) * 0.5;
          v[i] = -(psi[idx(x + 1, y)] - psi[idx(x - 1, y)]) * 0.5;
        }
      }
    }

    function sampleBilinear(field: Float64Array, fx: number, fy: number) {
      fx = Math.min(Math.max(fx, 0), NX - 1.001);
      fy = Math.min(Math.max(fy, 0), NY - 1.001);
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const a = field[idx(x0, y0)], b = field[idx(x0 + 1, y0)];
      const c = field[idx(x0, y0 + 1)], d = field[idx(x0 + 1, y0 + 1)];
      return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    }

    function step(h: number) {
      if (!s.running) return;
      solvePoisson();
      velocityFromPsi();
      // Advect T and w semi-Lagrangian (unconditionally stable), then diffuse and force.
      for (let y = 1; y < NY - 1; y++) {
        for (let x = 1; x < NX - 1; x++) {
          const i = idx(x, y);
          const bx = x - u[i] * h * 40, by = y - v[i] * h * 40;
          Tn[i] = sampleBilinear(T, bx, by);
          wn[i] = sampleBilinear(w, bx, by);
        }
      }
      const kappa = 0.02, nu = s.viscosity;
      for (let y = 1; y < NY - 1; y++) {
        for (let x = 1; x < NX - 1; x++) {
          const i = idx(x, y);
          const lapT = T[idx(x - 1, y)] + T[idx(x + 1, y)] + T[idx(x, y - 1)] + T[idx(x, y + 1)] - 4 * T[i];
          const lapW = w[idx(x - 1, y)] + w[idx(x + 1, y)] + w[idx(x, y - 1)] + w[idx(x, y + 1)] - 4 * w[i];
          const dTdx = (T[idx(x + 1, y)] - T[idx(x - 1, y)]) * 0.5;
          Tn[i] += kappa * lapT;
          // buoyancy torque: hot fluid rises, generating vorticity from the horizontal T gradient
          wn[i] += nu * lapW + s.deltaT * 2.0 * dTdx * h * 60;
        }
      }
      for (let x = 0; x < NX; x++) {
        Tn[idx(x, 0)] = 1; Tn[idx(x, NY - 1)] = 0; // hot floor, cold ceiling
        wn[idx(x, 0)] = 0; wn[idx(x, NY - 1)] = 0;
      }
      for (let y = 0; y < NY; y++) {
        // side walls: no-slip-ish, insulating (zero-gradient temperature)
        Tn[idx(0, y)] = Tn[idx(1, y)]; Tn[idx(NX - 1, y)] = Tn[idx(NX - 2, y)];
        wn[idx(0, y)] = 0; wn[idx(NX - 1, y)] = 0;
      }
      T.set(Tn); w.set(wn);
    }

    function render() {
      const w2 = stage.canvas.width, h2 = stage.canvas.height;
      // draw into the small imageData then blit scaled (nearest → let CSS smooth it)
      const warm = hexToRgb(pal.bad), cool = hexToRgb(pal.accent2 || pal.accent);
      for (let i = 0; i < NX * NY; i++) {
        const t = Math.min(1, Math.max(0, T[i]));
        const r = warm[0] * t + cool[0] * (1 - t);
        const g = warm[1] * t + cool[1] * (1 - t);
        const b = warm[2] * t + cool[2] * (1 - t);
        img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
      }
      const off = document.createElement('canvas');
      off.width = NX; off.height = NY;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx2.imageSmoothingEnabled = true;
      ctx2.clearRect(0, 0, w2, h2);
      ctx2.drawImage(off, 0, 0, w2, h2);
      // velocity glyphs
      ctx2.strokeStyle = pal.fg; ctx2.globalAlpha = 0.35; ctx2.lineWidth = Math.max(1, w2 / NX * 0.08);
      const step2 = 6;
      ctx2.beginPath();
      for (let y = 2; y < NY - 2; y += step2) {
        for (let x = 2; x < NX - 2; x += step2) {
          const i = idx(x, y);
          const px = (x / NX) * w2, py = (y / NY) * h2;
          const scale = 12;
          ctx2.moveTo(px, py);
          ctx2.lineTo(px + u[i] * scale, py + v[i] * scale);
        }
      }
      ctx2.stroke(); ctx2.globalAlpha = 1;
    }

    function hexToRgb(hex: string): [number, number, number] {
      const m = hex.match(/[\d.]+/g);
      if (hex.startsWith('#')) {
        const h2 = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1);
        const n = parseInt(h2.slice(0, 6), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
      return [255, 255, 255];
    }

    const panel = new Panel(host);
    const rayleighish = () => s.deltaT / s.viscosity;
    const rRa = panel.readout('ΔT / ν  (Rayleigh proxy)');
    panel.slider('Temperature difference ΔT', { min: 0, max: 3, value: s.deltaT, step: 0.02 }, (v) => { s.deltaT = v; });
    panel.slider('Viscosity ν', { min: 0.02, max: 0.3, value: s.viscosity, step: 0.005 }, (v) => { s.viscosity = v; });
    panel.button('Randomise seed', () => initFields());
    panel.playPause(() => !s.running, (p) => (s.running = !p));

    const loop = new Loop(step, () => { render(); rRa.set(fmt(rayleighish(), 3) + (rayleighish() > 6 ? '  — convecting' : '  — stable, conducting')); }, 1 / 60);
    stage.onResize(() => loop.invalidate());
    onDestroy(() => {});
    return { setVisible: (vv) => loop.setVisible(vv), destroy: () => loop.destroy() };
  },
});
