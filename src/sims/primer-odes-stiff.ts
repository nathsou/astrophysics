// Appendix A5: a stiff equation. y′ = −λ (y − cos t), y(0) = 0: after a fast transient (timescale 1/λ)
// the solution just follows cos t. Explicit Euler is stable only for hλ < 2; implicit (backward)
// Euler is stable for every h. Right panel: the amplification factor per step, |g(hλ)|, for both.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const T_END = 6;

function exact(t: number, lam: number) {
  const d = lam * lam + 1;
  return (lam * lam * Math.cos(t) + lam * Math.sin(t)) / d - ((lam * lam) / d) * Math.exp(-lam * t);
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let lam = 50;
    let h = 0.05;
    let showRK4 = false;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);';
    host.append(wrap);
    const left = createStage(wrap, { aspect: 1.45 });
    const right = createStage(wrap, { aspect: 0.9 });
    left.el.style.borderRight = '1px solid var(--rule)';
    const main = new Plot(left.canvas, { x: { min: 0, max: T_END, label: 'time t' }, y: { min: -2, max: 2, label: 'y' }, title: 'y′ = −λ (y − cos t)' });
    const amp = new Plot(right.canvas, {
      x: { min: 0.01, max: 1000, log: true, label: 'hλ' },
      y: { min: 1e-3, max: 1e3, log: true, label: '|growth factor per step|' },
      title: 'Stability',
      margin: { l: 50, r: 10, t: 28, b: 42 },
    });
    const loop = new Loop(null, render);

    function run(kind: 'explicit' | 'implicit' | 'rk4') {
      const n = Math.ceil(T_END / h);
      const ts = new Float64Array(n + 1), ys = new Float64Array(n + 1);
      let y = 0, t = 0, blew = -1;
      const f = (tt: number, yy: number) => -lam * (yy - Math.cos(tt));
      for (let i = 1; i <= n; i++) {
        if (kind === 'explicit') y = y + h * f(t, y);
        else if (kind === 'implicit') y = (y + h * lam * Math.cos(t + h)) / (1 + h * lam); // solve y₁ = y₀ + h f(t₁, y₁) exactly (linear)
        else {
          const k1 = f(t, y), k2 = f(t + h / 2, y + (h / 2) * k1), k3 = f(t + h / 2, y + (h / 2) * k2), k4 = f(t + h, y + h * k3);
          y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        }
        t += h;
        ts[i] = t; ys[i] = Number.isFinite(y) ? Math.max(-50, Math.min(50, y)) : NaN;
        if (blew < 0 && !(Math.abs(y) < 1e6)) blew = t;
      }
      return { ts, ys, blew, final: y };
    }

    function render() {
      const E = run('explicit'), I = run('implicit'), R = showRK4 ? run('rk4') : null;
      const z = h * lam;
      main.draw(() => {
        main.hline(0, { color: pal.axis, dash: [], width: 1 });
        main.fn((t) => Math.cos(t), { color: pal.faint, dash: [2, 4], width: 1 });
        main.fn((t) => exact(t, lam), { color: pal.fg, width: 2.2, samples: 1200 });
        const dots = E.ts.length < 150;
        main.line(E.ts, E.ys, { color: pal.series[2], width: 1.6 });
        main.line(I.ts, I.ys, { color: pal.series[0], width: 1.8 });
        if (R) main.line(R.ts, R.ys, { color: pal.series[1], width: 1.4 });
        if (dots) {
          for (let i = 0; i < E.ts.length; i++) if (Math.abs(E.ys[i]) < 3) main.point(E.ts[i], E.ys[i], { r: 2.5, color: pal.series[2] });
          for (let i = 0; i < I.ts.length; i++) main.point(I.ts[i], I.ys[i], { r: 2.5, color: pal.series[0] });
        }
      });
      let Y = main.m.t + 14;
      const lab = (txt: string, col: string) => { main.text(txt, main.m.l + 10, Y, { color: col }); Y += 16; };
      lab('— exact', pal.fg);
      lab(`— explicit Euler${E.blew >= 0 ? `  (exploded by t = ${fmt(E.blew, 2)})` : Math.abs(1 - z) > 1 ? '  (growing!)' : ''}`, pal.series[2]);
      lab('— implicit Euler', pal.series[0]);
      if (R) lab(`— RK4${R.blew >= 0 ? `  (exploded by t = ${fmt(R.blew, 2)})` : ''}`, pal.series[1]);

      amp.draw(() => {
        amp.hline(1, { color: pal.muted, label: 'stable below' });
        amp.fn((x) => Math.abs(1 - x), { color: pal.series[2], width: 2, samples: 600 });
        amp.fn((x) => 1 / (1 + x), { color: pal.series[0], width: 2 });
        if (showRK4) amp.fn((x) => Math.abs(1 - x + (x * x) / 2 - (x * x * x) / 6 + (x * x * x * x) / 24), { color: pal.series[1], width: 1.5, samples: 600 });
        amp.vline(2, { color: pal.series[2], label: 'hλ = 2' });
        amp.vline(z, { color: pal.accent, dash: [], width: 1.5 });
        amp.point(z, Math.max(1e-3, Math.abs(1 - z)), { r: 4.5, color: pal.series[2], stroke: pal.fg });
        amp.point(z, 1 / (1 + z), { r: 4.5, color: pal.series[0], stroke: pal.fg });
      });
      amp.text('explicit |1 − hλ|', amp.m.l + amp.pw - 6, amp.m.t + 14, { color: pal.series[2], align: 'right' });
      amp.text('implicit 1/(1 + hλ)', amp.m.l + 8, amp.m.t + amp.ph - 10, { color: pal.series[0] });

      zRead.set(fmt(z, 3));
      nRead.set(`${Math.ceil(T_END / h)} (explicit needs ≥ ${Math.ceil((T_END * lam) / 2)})`);
    }

    left.onResize((w, hh, d) => { main.resize(w, hh, d); loop.invalidate(); });
    right.onResize((w, hh, d) => { amp.resize(w, hh, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('Stiffness λ', { min: 1, max: 1000, value: lam, log: true, format: (v) => fmt(v, 3) }, (v) => { lam = v; loop.invalidate(); });
    panel.slider('Step h', { min: 0.001, max: 0.5, value: h, log: true }, (v) => { h = v; loop.invalidate(); });
    panel.toggle('Show RK4', showRK4, (v) => { showRK4 = v; loop.invalidate(); });
    const zRead = panel.readout('hλ =');
    const nRead = panel.readout('steps:');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
