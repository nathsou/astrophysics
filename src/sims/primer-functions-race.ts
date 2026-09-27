// Appendix A2: a race between a power law x^n and an exponential b^x.
// Crossovers solve n·ln x = x·ln b; the log-y view turns the exponential into a straight line.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

/** Positive roots of g(x) = n ln x − x ln b (where x^n = b^x). */
function crossings(n: number, b: number): number[] {
  const lb = Math.log(b);
  const g = (x: number) => n * Math.log(x) - x * lb;
  const xm = n / lb; // maximum of g
  if (g(xm) <= 0) return [];
  const bisect = (lo: number, hi: number) => {
    const slo = Math.sign(g(lo));
    for (let i = 0; i < 100; i++) {
      const mid = 0.5 * (lo + hi);
      if (Math.sign(g(mid)) === slo) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  };
  let hi = xm * 2;
  while (g(hi) > 0) hi *= 2;
  return [bisect(1e-9, xm), bisect(xm, hi)];
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let n = 10, b = 2, xEnd = 80, logY = false;
    let x = 0; // race position

    const stage = createStage(host, { aspect: 16 / 8 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: xEnd, label: 'x' },
      y: { min: 0, max: 1, label: 'y' },
      title: '',
    });

    const loop = new Loop((dt) => {
      x += dt * xEnd / 8; // one race lasts ~8 s
      if (x > xEnd) { x = xEnd; loop.paused = true; play.textContent = '▶ Race'; }
    }, render, 1 / 60);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const pw = (t: number) => Math.pow(t, n);
    const ex = (t: number) => Math.pow(b, t);

    function render() {
      const xr = Math.max(x, xEnd * 0.02);
      plot.o.x.max = xEnd;
      if (logY) {
        plot.o.y = { min: 0.1, max: Math.max(10, pw(xEnd), ex(xEnd)) * 10, log: true, label: 'y (log scale)' };
      } else {
        // Linear view zooms to follow whoever is leading at the race position.
        plot.o.y = { min: 0, max: Math.max(pw(xr), ex(xr), 1) * 1.15, label: 'y (linear scale)' };
      }
      const cr = crossings(n, b);
      plot.draw(() => {
        plot.fn(pw, { color: pal.series[1], width: 2 });
        plot.fn(ex, { color: pal.series[2], width: 2 });
        for (const c of cr) if (c < xEnd) plot.vline(c, { color: pal.muted, label: `cross @ ${fmt(c, 3)}` });
        plot.vline(x, { color: pal.fg, dash: [], width: 1, alpha: 0.4 });
        if (!logY || pw(x) > 0) plot.point(x, Math.max(pw(x), logY ? 0.1 : 0), { color: pal.series[1], r: 5 });
        plot.point(x, ex(x), { color: pal.series[2], r: 5 });
      });
      // Legend in the bottom-right corner, which both curves leave empty in either view (and clear of
      // the crossover labels along the top).
      const lx = plot.m.l + plot.pw - 10, ly = plot.m.t + plot.ph - 34;
      plot.text(`power law  x${n === 1 ? '' : sup(n)}`, lx, ly, { color: pal.series[1], size: 13, align: 'right' });
      plot.text(`exponential  ${fmt(b, 3)}ˣ`, lx, ly + 18, { color: pal.series[2], size: 13, align: 'right' });
      const P = pw(x), E = ex(x);
      rX.set(`x = ${fmt(x, 3)}`);
      rP.set(fmt(P, 3));
      rE.set(fmt(E, 3));
      rLead.set(x === 0 ? '—' : P > E ? `power law, ×${fmt(P / E, 2)}` : `exponential, ×${fmt(E / Math.max(P, 1e-300), 2)}`);
    }

    const panel = new Panel(host);
    const play = panel.button('▶ Race', () => {
      if (x >= xEnd) x = 0;
      loop.paused = !loop.paused;
      play.textContent = loop.paused ? '▶ Race' : '❚❚ Pause';
      loop.invalidate();
    }, true);
    panel.button('Reset', () => { x = 0; loop.paused = true; play.textContent = '▶ Race'; loop.invalidate(); });
    panel.toggle('log y-axis', logY, (v) => { logY = v; loop.invalidate(); });
    panel.slider('Power n', { min: 1, max: 20, value: n, step: 1, format: (v) => String(Math.round(v)) }, (v) => { n = Math.round(v); loop.invalidate(); });
    panel.slider('Base b', { min: 1.05, max: 4, value: b, step: 0.01, log: true }, (v) => { b = v; loop.invalidate(); });
    panel.slider('x range', { min: 5, max: 200, value: xEnd, step: 1, log: true, format: (v) => String(Math.round(v)) }, (v) => { xEnd = Math.round(v); x = Math.min(x, xEnd); loop.invalidate(); });
    const rX = panel.readout('');
    const rP = panel.readout('power law:');
    const rE = panel.readout('exponential:');
    const rLead = panel.readout('leader:');
    loop.paused = true;

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});

function sup(k: number) {
  return [...String(k)].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
}
