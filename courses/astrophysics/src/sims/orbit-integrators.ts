// Chapter 2 flagship: the same Kepler orbit integrated three ways (Euler, RK4, velocity Verlet),
// with live relative-energy-error plot. Units: G·M = 4π² (AU, yr, M☉) so a 1 AU circular orbit has P = 1 yr.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const GM = 4 * Math.PI * Math.PI;

type State = Float64Array; // [x, y, vx, vy]
type Method = 'euler' | 'rk4' | 'verlet';

function accel(x: number, y: number): [number, number] {
  const r2 = x * x + y * y;
  const inv = GM / (r2 * Math.sqrt(r2));
  return [-x * inv, -y * inv];
}

const energy = (s: State) => 0.5 * (s[2] * s[2] + s[3] * s[3]) - GM / Math.hypot(s[0], s[1]);

const steppers: Record<Method, (s: State, h: number) => void> = {
  euler(s, h) {
    const [ax, ay] = accel(s[0], s[1]);
    s[0] += h * s[2]; s[1] += h * s[3];
    s[2] += h * ax; s[3] += h * ay;
  },
  rk4(s, h) {
    const f = (x: number, y: number, vx: number, vy: number) => { const [ax, ay] = accel(x, y); return [vx, vy, ax, ay]; };
    const [x, y, vx, vy] = s;
    const k1 = f(x, y, vx, vy);
    const k2 = f(x + (h / 2) * k1[0], y + (h / 2) * k1[1], vx + (h / 2) * k1[2], vy + (h / 2) * k1[3]);
    const k3 = f(x + (h / 2) * k2[0], y + (h / 2) * k2[1], vx + (h / 2) * k2[2], vy + (h / 2) * k2[3]);
    const k4 = f(x + h * k3[0], y + h * k3[1], vx + h * k3[2], vy + h * k3[3]);
    for (let i = 0; i < 4; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  },
  verlet(s, h) {
    // kick-drift-kick leapfrog (symplectic, time-reversible)
    let [ax, ay] = accel(s[0], s[1]);
    s[2] += 0.5 * h * ax; s[3] += 0.5 * h * ay;
    s[0] += h * s[2]; s[1] += h * s[3];
    [ax, ay] = accel(s[0], s[1]);
    s[2] += 0.5 * h * ax; s[3] += 0.5 * h * ay;
  },
};

const METHODS: { id: Method; label: string; color: number }[] = [
  { id: 'euler', label: 'Euler', color: 2 },
  { id: 'rk4', label: 'RK4', color: 1 },
  { id: 'verlet', label: 'Verlet', color: 0 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : 'minmax(0,1.1fr) minmax(0,1fr)'}`;
    host.append(wrap);
    const orbitStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 / 0.92 });
    orbitStage.el.style[narrow ? 'borderBottom' : 'borderRight'] = '1px solid var(--rule)';
    const ctx = orbitStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: 0, max: 20, label: 'time (orbits)' },
      y: { min: 1e-10, max: 1, log: true, label: '|ΔE / E₀|' },
      title: 'Energy error',
    });

    // parameters
    let ecc = 0.6;
    let stepsPerOrbit = 200;
    const trails = METHODS.map(() => ({ xs: new Float32Array(4000), ys: new Float32Array(4000), n: 0, head: 0 }));
    const states = METHODS.map(() => new Float64Array(4));
    const errs = METHODS.map(() => new Series(4000));
    const winMax = METHODS.map(() => 0);
    let E0 = 0, t = 0, period = 1;

    function reset() {
      // Start at perihelion of an orbit with semi-major axis a = 1 AU.
      const a = 1, rp = a * (1 - ecc);
      const vp = Math.sqrt((GM * (1 + ecc)) / rp);
      for (const s of states) s.set([rp, 0, 0, vp]);
      E0 = energy(states[0]);
      period = 1; // a = 1 AU ⇒ P = 1 yr
      t = 0;
      trails.forEach((tr) => { tr.n = 0; tr.head = 0; });
      errs.forEach((e) => e.clear());
      plot.o.x.max = 20;
    }
    reset();

    let sub = 0;
    const loop = new Loop((dt) => {
      // Each loop tick advances a fixed number of integrator steps: ~2 orbits per real second.
      const h = period / stepsPerOrbit;
      const n = Math.max(1, Math.round((2 * dt * stepsPerOrbit)));
      for (let k = 0; k < n; k++) {
        states.forEach((s, i) => {
          steppers[METHODS[i].id](s, h);
          const err = Math.abs((energy(s) - E0) / E0);
          winMax[i] = Math.max(winMax[i], Number.isFinite(err) ? err : 1);
        });
        t += h;
        if (++sub % Math.max(1, Math.round(stepsPerOrbit / 100)) === 0) {
          states.forEach((s, i) => {
            const tr = trails[i];
            tr.xs[tr.head] = s[0]; tr.ys[tr.head] = s[1];
            tr.head = (tr.head + 1) % tr.xs.length; tr.n = Math.min(tr.n + 1, tr.xs.length);
            // plot the max over the sampling window so fast oscillations show as an envelope
            errs[i].push(t / period, Math.max(winMax[i], 1e-16));
            winMax[i] = 0;
          });
        }
      }
      if (t / period > plot.o.x.max) plot.o.x.max *= 2;
    }, render, 1 / 60);

    function render() {
      const { width: W, height: H, dpr } = orbitStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) / 4.2;
      const cx = W / 2 + scale * 0.6, cy = H / 2;
      // exact ellipse
      const a = 1, b = a * Math.sqrt(1 - ecc * ecc), c = a * ecc;
      ctx.strokeStyle = pal.faint;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.ellipse(cx - c * scale, cy, a * scale, b * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // star
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      g.addColorStop(0, '#fff6dd'); g.addColorStop(0.3, '#f0b35a'); g.addColorStop(1, 'rgba(240,179,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      // trails + bodies
      METHODS.forEach((m, i) => {
        const tr = trails[i], col = pal.series[m.color];
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
        ctx.beginPath();
        const start = (tr.head - tr.n + tr.xs.length) % tr.xs.length;
        for (let k = 0; k < tr.n; k++) {
          const j = (start + k) % tr.xs.length;
          const X = cx + tr.xs[j] * scale, Y = cy - tr.ys[j] * scale;
          if (Math.abs(X) > 1e5 || Math.abs(Y) > 1e5) break;
          k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        const s = states[i];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(cx + s[0] * scale, cy - s[1] * scale, 4.5, 0, Math.PI * 2); ctx.fill();
      });
      // legend
      ctx.font = '12px Inter, system-ui, sans-serif';
      METHODS.forEach((m, i) => {
        ctx.fillStyle = pal.series[m.color];
        ctx.fillRect(14, 16 + i * 18, 10, 3);
        ctx.fillStyle = pal.fg;
        ctx.fillText(m.label, 30, 21 + i * 18);
      });
      ctx.fillStyle = pal.muted;
      ctx.fillText(`t = ${fmt(t / period, 3)} orbits`, 14, H - 14);

      plot.draw(() => {
        METHODS.forEach((m, i) => {
          const [xs, ys] = errs[i].linear();
          plot.line(xs, ys, { color: pal.series[m.color] });
        });
      });
    }

    orbitStage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.slider('Eccentricity', { min: 0, max: 0.95, value: ecc, step: 0.01 }, (v) => { ecc = v; reset(); loop.invalidate(); });
    panel.slider('Steps / orbit', { min: 20, max: 5000, value: stepsPerOrbit, log: true, step: 1, format: (v) => String(Math.round(v)) }, (v) => { stepsPerOrbit = Math.round(v); reset(); loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
