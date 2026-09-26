// Appendix A4: Riemann sums converging to an integral. Left: the area under f(x) chopped into N
// strips (left / midpoint / trapezoid rules). Right: the error against N on log–log axes, where the
// slope reveals the order of the rule (−1 for left-endpoint, −2 for midpoint and trapezoid).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

type Rule = 'left' | 'mid' | 'trap';

interface Fn { id: string; label: string; f: (x: number) => number; a: number; b: number; y: [number, number]; xLabel: string; note: string }

const FNS: Fn[] = [
  { id: 'sq', label: 'y = x² on [0, 2]', f: (x) => x * x, a: 0, b: 2, y: [0, 4.4], xLabel: 'x', note: 'exact 8/3' },
  { id: 'grav', label: '1/r² on [1, 5] (work against gravity)', f: (x) => 1 / (x * x), a: 1, b: 5, y: [0, 1.1], xLabel: 'r (in units of R)', note: 'exact 1 − 1/5 = 0.8' },
  { id: 'planck', label: 'Planck: x³/(eˣ − 1) on [0, 12]', f: (x) => (x < 1e-8 ? x * x : (x * x * x) / Math.expm1(x)), a: 0, b: 12, y: [0, 1.6], xLabel: 'x = hν / kT', note: '→ π⁴/15 over [0, ∞)' },
  { id: 'sin', label: 'y = sin x on [0, π]', f: Math.sin, a: 0, b: Math.PI, y: [0, 1.15], xLabel: 'x (radians)', note: 'exact 2' },
];

function riemann(f: (x: number) => number, a: number, b: number, n: number, rule: Rule) {
  const h = (b - a) / n;
  let s = 0;
  if (rule === 'left') for (let i = 0; i < n; i++) s += f(a + i * h);
  else if (rule === 'mid') for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
  else { s = 0.5 * (f(a) + f(b)); for (let i = 1; i < n; i++) s += f(a + i * h); }
  return s * h;
}

/** Reference value: composite Simpson with many panels (error ≲ 1e-13 for these smooth integrands). */
function reference(fn: Fn) {
  const n = 200000, h = (fn.b - fn.a) / n;
  let s = fn.f(fn.a) + fn.f(fn.b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fn.f(fn.a + i * h);
  return (s * h) / 3;
}

const RULES: { value: Rule; label: string }[] = [
  { value: 'left', label: 'Left endpoint' },
  { value: 'mid', label: 'Midpoint' },
  { value: 'trap', label: 'Trapezoid' },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let fn = FNS[0];
    let rule: Rule = 'left';
    let N = 6;
    let exact = reference(fn);
    const NMAX = 2000;
    const errNs = new Float64Array(80), errs: Record<Rule, Float64Array> = { left: new Float64Array(80), mid: new Float64Array(80), trap: new Float64Array(80) };

    function recompute() {
      exact = reference(fn);
      for (let k = 0; k < errNs.length; k++) {
        const n = Math.max(1, Math.round(Math.pow(NMAX, k / (errNs.length - 1))));
        errNs[k] = n;
        for (const r of RULES) errs[r.value][k] = Math.max(1e-16, Math.abs(riemann(fn.f, fn.a, fn.b, n, r.value) - exact));
      }
    }
    recompute();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);';
    host.append(wrap);
    const left = createStage(wrap, { aspect: 1.35 });
    const right = createStage(wrap, { aspect: 0.85 });
    left.el.style.borderRight = '1px solid var(--rule)';

    const main = new Plot(left.canvas, { x: { min: fn.a, max: fn.b, label: fn.xLabel }, y: { min: fn.y[0], max: fn.y[1] } });
    const errPlot = new Plot(right.canvas, {
      x: { min: 1, max: NMAX, log: true, label: 'number of strips N' },
      y: { min: 1e-12, max: 10, log: true, label: '|sum − exact|' },
      title: 'Error vs N',
      margin: { l: 50, r: 10, t: 28, b: 42 },
    });

    const loop = new Loop(null, render);

    function render() {
      const S = riemann(fn.f, fn.a, fn.b, N, rule);
      const h = (fn.b - fn.a) / N;
      main.o.x.min = fn.a; main.o.x.max = fn.b; main.o.x.label = fn.xLabel;
      main.o.y.min = fn.y[0]; main.o.y.max = fn.y[1];
      main.draw(() => {
        const { ctx } = main;
        const y0 = main.py(0);
        ctx.fillStyle = pal.accent;
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1;
        for (let i = 0; i < N; i++) {
          const xa = fn.a + i * h, xb = xa + h;
          ctx.beginPath();
          if (rule === 'trap') {
            ctx.moveTo(main.px(xa), y0);
            ctx.lineTo(main.px(xa), main.py(fn.f(xa)));
            ctx.lineTo(main.px(xb), main.py(fn.f(xb)));
            ctx.lineTo(main.px(xb), y0);
          } else {
            const yv = fn.f(rule === 'left' ? xa : xa + h / 2);
            ctx.rect(main.px(xa), main.py(yv), main.px(xb) - main.px(xa), y0 - main.py(yv));
          }
          ctx.globalAlpha = 0.28; ctx.fill();
          if (N <= 120) { ctx.globalAlpha = 0.8; ctx.stroke(); }
          ctx.globalAlpha = 1;
        }
        main.fn(fn.f, { color: pal.fg, width: 2 });
      });
      main.text(`sum = ${S.toFixed(6)}`, main.m.l + 10, main.m.t + 14, { color: pal.accent });
      main.text(`integral = ${exact.toFixed(6)}  (${fn.note})`, main.m.l + 10, main.m.t + 31, { color: pal.fg });

      errPlot.draw(() => {
        RULES.forEach((r, i) => {
          const col = pal.series[i];
          errPlot.line(errNs, errs[r.value], { color: col, width: r.value === rule ? 2.4 : 1.2, alpha: r.value === rule ? 1 : 0.45 });
        });
        // guide slopes through a common anchor
        const e0 = 0.3;
        errPlot.fn((n) => e0 / n, { color: pal.faint, dash: [3, 4], width: 1 });
        errPlot.fn((n) => e0 / (n * n), { color: pal.faint, dash: [3, 4], width: 1 });
        const E = Math.max(1e-16, Math.abs(S - exact));
        errPlot.point(N, Math.max(E, errPlot.o.y.min), { r: 4.5, color: pal.series[RULES.findIndex((r) => r.value === rule)], stroke: pal.fg });
      });
      errPlot.text('∝ 1/N', errPlot.px(30), errPlot.py(0.3 / 30) - 4, { color: pal.muted, align: 'left', baseline: 'bottom' });
      errPlot.text('∝ 1/N²', errPlot.px(30), errPlot.py(0.3 / 900) + 4, { color: pal.muted, align: 'left', baseline: 'top' });
      let Y = errPlot.m.t + errPlot.ph - 10 - 15 * (RULES.length - 1);
      RULES.forEach((r, i) => {
        errPlot.text(r.label, errPlot.m.l + errPlot.pw - 6, Y, { color: pal.series[i], align: 'right', baseline: 'middle' });
        Y += 15;
      });
      errRead.set(fmt(Math.abs(S - exact), 3));
    }

    left.onResize((w, hh, d) => { main.resize(w, hh, d); loop.invalidate(); });
    right.onResize((w, hh, d) => { errPlot.resize(w, hh, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.select('Integrand', FNS.map((f) => ({ value: f.id, label: f.label })), fn.id, (id) => { fn = FNS.find((f) => f.id === id)!; recompute(); loop.invalidate(); });
    panel.select('Rule', RULES, rule, (r) => { rule = r; loop.invalidate(); });
    panel.slider('Strips N', { min: 1, max: 500, value: N, log: true, step: 1, format: (v) => String(Math.round(v)) }, (v) => { N = Math.max(1, Math.round(v)); loop.invalidate(); });
    const errRead = panel.readout('error');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
