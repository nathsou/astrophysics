// Appendix A5: Euler vs RK4 vs leapfrog on the harmonic oscillator x″ = −x (ω = 1, period 2π).
// Left: phase-space trajectories (x, v) against the exact circle, stepping live at the chosen h.
// Right: global error at t = T against step size on log–log axes, whose slopes (1, 2, 4) are the orders.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { stackWhenNarrow } from './primer-common/stack';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

type Method = 'euler' | 'rk4' | 'leapfrog';
type Stepper = (s: Float64Array, h: number) => void;

// state s = [x, v]; acceleration a(x) = −x
const STEP: Record<Method, Stepper> = {
  euler(s, h) {
    const x = s[0], v = s[1];
    s[0] = x + h * v;
    s[1] = v - h * x;
  },
  rk4(s, h) {
    const x = s[0], v = s[1];
    const k1x = v, k1v = -x;
    const k2x = v + (h / 2) * k1v, k2v = -(x + (h / 2) * k1x);
    const k3x = v + (h / 2) * k2v, k3v = -(x + (h / 2) * k2x);
    const k4x = v + h * k3v, k4v = -(x + h * k3x);
    s[0] = x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    s[1] = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  },
  leapfrog(s, h) {
    s[1] -= 0.5 * h * s[0]; // half kick
    s[0] += h * s[1];       // drift
    s[1] -= 0.5 * h * s[0]; // half kick
  },
};

const METHODS: { id: Method; label: string; color: number; order: number }[] = [
  { id: 'euler', label: 'Euler', color: 2, order: 1 },
  { id: 'rk4', label: 'RK4', color: 1, order: 4 },
  { id: 'leapfrog', label: 'Leapfrog', color: 0, order: 2 },
];

const T_END = 20; // about 3.2 periods

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    let h = 0.3;

    // ---- static convergence study (recomputed once) ----
    const NH = 60;
    const hs = new Float64Array(NH);
    const errs = METHODS.map(() => new Float64Array(NH));
    for (let k = 0; k < NH; k++) {
      const n = Math.max(1, Math.round(T_END / (2.5 * Math.pow(1e-4 / 2.5, k / (NH - 1)))));
      const hk = T_END / n;
      hs[k] = hk;
      METHODS.forEach((m, i) => {
        const s = new Float64Array([1, 0]);
        for (let j = 0; j < n; j++) STEP[m.id](s, hk);
        const e = Math.hypot(s[0] - Math.cos(T_END), s[1] + Math.sin(T_END));
        errs[i][k] = Math.max(1e-17, Math.min(e, 1e3));
      });
    }

    let kAnchor = 0;
    while (kAnchor < NH - 1 && hs[kAnchor] > 0.05) kAnchor++;

    // ---- live phase-space run ----
    const states = METHODS.map(() => new Float64Array([1, 0]));
    const TRAIL = 3000;
    const trails = METHODS.map(() => ({ x: new Float64Array(TRAIL), v: new Float64Array(TRAIL), n: 0 }));
    let t = 0, acc = 0;
    function reset() {
      states.forEach((s) => s.set([1, 0]));
      trails.forEach((tr) => { tr.x[0] = 1; tr.v[0] = 0; tr.n = 1; });
      t = 0; acc = 0;
    }
    reset();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);';
    host.append(wrap);
    const left = createStage(wrap, { aspect: 1 });
    const right = createStage(wrap, { aspect: 1 / 0.87 });
    stackWhenNarrow(host, wrap, 'minmax(0,1fr) minmax(0,1.15fr)', [[left, 1, 1.2], [right, 1.149, 1.3]], onDestroy);
    left.el.style.borderRight = '1px solid var(--rule)';
    const phase = new Plot(left.canvas, { x: { min: -2.2, max: 2.2, label: 'position x' }, y: { min: -2.2, max: 2.2, label: 'velocity v' }, title: 'Phase space', margin: { l: 44, r: 10, t: 28, b: 40 } });
    const conv = new Plot(right.canvas, {
      x: { min: 1e-4, max: 3, log: true, label: 'step size h (period = 2π ≈ 6.3)' },
      y: { min: 1e-16, max: 10, log: true, label: 'error at t = 20' },
      title: 'Global error vs step size',
      margin: { l: 50, r: 10, t: 28, b: 42 },
    });

    const RATE = 2.0; // simulated time units per real second
    const loop = new Loop((dt) => {
      acc += dt * RATE;
      while (acc >= h) {
        acc -= h;
        t += h;
        METHODS.forEach((m, i) => {
          const s = states[i];
          if (Math.hypot(s[0], s[1]) > 20) return; // far off the plot: stop advancing this one
          STEP[m.id](s, h);
          const tr = trails[i];
          if (tr.n < TRAIL) { tr.x[tr.n] = s[0]; tr.v[tr.n] = s[1]; tr.n++; }
        });
        if (t > 60 || trails[0].n >= TRAIL) { reset(); break; }
      }
    }, render, 1 / 60);

    function render() {
      phase.draw(() => {
        const { ctx } = phase;
        ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(phase.px(0), phase.py(0), phase.px(1) - phase.px(0), phase.py(0) - phase.py(1), 0, 0, Math.PI * 2);
        ctx.stroke(); ctx.setLineDash([]);
        METHODS.forEach((m, i) => {
          const tr = trails[i];
          phase.line(tr.x, tr.v, { n: tr.n, color: pal.series[m.color], width: 1.4, alpha: 0.75 });
          const s = states[i];
          phase.point(s[0], s[1], { r: 4.5, color: pal.series[m.color] });
        });
        phase.point(Math.cos(t), -Math.sin(t), { r: 3, color: pal.fg });
      });
      METHODS.forEach((m, i) => {
        phase.text(m.label, phase.m.l + 8, phase.m.t + 14 + 16 * i, { color: pal.series[m.color] });
      });
      phase.text(`t = ${fmt(t, 3)}`, phase.m.l + phase.pw - 6, phase.m.t + phase.ph - 8, { color: pal.muted, align: 'right' });

      conv.draw(() => {
        // guide lines of slope 1, 2, 4, anchored a factor 8 above each curve at h ≈ 0.05
        METHODS.forEach((m, i) => {
          const e0 = 8 * errs[i][kAnchor], h0 = hs[kAnchor];
          conv.fn((x) => e0 * Math.pow(x / h0, m.order), { color: pal.faint, dash: [3, 4], width: 1 });
        });
        METHODS.forEach((m, i) => conv.line(hs, errs[i], { color: pal.series[m.color], width: 2 }));
        conv.vline(h, { color: pal.fg, label: `h = ${fmt(h, 2)}` });
      });
      METHODS.forEach((m, i) => {
        conv.text(`${m.label} ∝ h${m.order === 1 ? '¹' : m.order === 2 ? '²' : '⁴'}`, conv.m.l + conv.pw - 6, conv.m.t + conv.ph - 10 - 16 * (2 - i), { color: pal.series[m.color], align: 'right' });
      });
      const E = (s: Float64Array) => 0.5 * (s[0] * s[0] + s[1] * s[1]);
      energy.set(METHODS.map((m, i) => `${m.label} ${fmt(E(states[i]) / 0.5, 4)}`).join(' · '));
    }

    left.onResize((w, hh, d) => { phase.resize(w, hh, d); loop.invalidate(); });
    right.onResize((w, hh, d) => { conv.resize(w, hh, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.slider('Step h', { min: 0.01, max: 2.5, value: h, log: true }, (v) => { h = v; reset(); loop.invalidate(); });
    const energy = panel.readout('E / E₀:');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
