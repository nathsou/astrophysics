// Chapter 27: E-modes vs B-modes. Polarisation is drawn as headless sticks (orientation ψ = ½ atan2(U, Q),
// length ∝ √(Q²+U²)). E-mode patterns are radial/tangential around a spot, or parallel/perpendicular
// to a plane wave's k; B-mode patterns are the same rotated by 45°: they swirl, and have handedness.
// Flat-sky decomposition: Q ± iU = −Σ_k (E_k ± iB_k) e^{±2iφ_k} e^{ik·x}.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Mode = 'spot' | 'wave' | 'random';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let mode: Mode = 'spot', bfrac = 0, t = 0, seed = 3;

    // random-sky modes
    let modes: { kx: number; ky: number; ph: number; e: number; b: number }[] = [];
    function makeModes() {
      let s = seed * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const g = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-9))) * Math.cos(2 * Math.PI * rnd());
      modes = [];
      for (let i = 0; i < 120; i++) {
        const k = 2 + 10 * rnd(), a = 2 * Math.PI * rnd();
        const amp = Math.exp(-((k - 5) ** 2) / 8);
        modes.push({ kx: k * Math.cos(a), ky: k * Math.sin(a), ph: 2 * Math.PI * rnd(), e: g() * amp, b: g() * amp });
      }
    }
    makeModes();

    // returns [Q, U, scalar] at (x, y) in units where the panel height = 1
    function field(x: number, y: number): [number, number, number] {
      const fe = Math.sqrt(1 - bfrac), fb = Math.sqrt(bfrac);
      if (mode === 'spot') {
        const r2 = x * x + y * y, phi = Math.atan2(y, x);
        // second-derivative profile of a Gaussian spot: sign change ⇒ radial inside, tangential outside
        const s = 0.18, prof = (r2 / (s * s)) * Math.exp(-r2 / (2 * s * s)) * (1 - r2 / (6 * s * s)) * 0.9;
        const Q = -prof * (fe * Math.cos(2 * phi) - fb * Math.sin(2 * phi));
        const U = -prof * (fe * Math.sin(2 * phi) + fb * Math.cos(2 * phi));
        return [Q, U, Math.exp(-r2 / (2 * s * s))];
      }
      if (mode === 'wave') {
        const a = 0.5 + 0.15 * t, k = 9;
        const c = Math.cos(k * (x * Math.cos(a) + y * Math.sin(a)) - 2 * t);
        const Q = c * (fe * Math.cos(2 * a) - fb * Math.sin(2 * a));
        const U = c * (fe * Math.sin(2 * a) + fb * Math.cos(2 * a));
        return [Q, U, c];
      }
      let Q = 0, U = 0, S = 0;
      for (const m of modes) {
        const c = Math.cos(m.kx * x + m.ky * y + m.ph);
        const a2 = 2 * Math.atan2(m.ky, m.kx);
        const E = m.e * fe, B = m.b * fb;
        Q += c * (E * Math.cos(a2) - B * Math.sin(a2));
        U += c * (E * Math.sin(a2) + B * Math.cos(a2));
        S += c * (bfrac > 0.5 ? m.b : m.e);
      }
      return [Q / 4, U / 4, S / 4];
    }

    let dirty = true;
    const inval = () => { dirty = true; loop.invalidate(); };
    const loop = new Loop((dt) => { if (mode === 'wave') t += dt; }, render, 1 / 60);
    function render() {
      if (!dirty && mode !== 'wave') return;
      dirty = false;
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const n = Math.max(14, Math.round(H / 20)), step = H / n, cols = Math.ceil(W / step);
      // background scalar (E or B "potential") as a faint diverging wash
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < n; j++) {
          const x = ((i + 0.5) * step - W / 2) / H, y = (H / 2 - (j + 0.5) * step) / H;
          const s = field(x, y)[2];
          ctx.fillStyle = s > 0 ? pal.series[3] : pal.series[0];
          ctx.globalAlpha = Math.min(0.35, Math.abs(s) * 0.3);
          ctx.fillRect(i * step, j * step, step + 0.5, step + 0.5);
        }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.fg;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < n; j++) {
          const X = (i + 0.5) * step, Y = (j + 0.5) * step;
          const [Q, U] = field((X - W / 2) / H, (H / 2 - Y) / H);
          const P = Math.hypot(Q, U);
          if (P < 0.02) continue;
          const psi = 0.5 * Math.atan2(U, Q);
          const L = Math.min(1, P) * step * 0.45;
          const dx = Math.cos(psi) * L, dy = -Math.sin(psi) * L;
          ctx.moveTo(X - dx, Y - dy);
          ctx.lineTo(X + dx, Y + dy);
        }
      ctx.stroke();
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.fg;
      ctx.fillText(bfrac < 0.02 ? 'pure E-mode' : bfrac > 0.98 ? 'pure B-mode' : `E + B mix (B power fraction ${(bfrac * 100).toFixed(0)}%)`, 10, 18);
    }

    stage.onResize(() => inval());
    onThemeChange(() => { pal = palette(); inval(); });
    const panel = new Panel(host);
    panel.select('Pattern', [{ value: 'spot', label: 'Around a hot spot' }, { value: 'wave', label: 'Single plane wave' }, { value: 'random', label: 'Random sky patch' }], mode, (v) => { mode = v; inval(); });
    panel.slider('B-mode fraction', { min: 0, max: 1, value: 0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` }, (v) => { bfrac = v; inval(); });
    panel.button('New patch', () => { seed++; makeModes(); inval(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
