// Chapter 7 figure: the Jeans mass across the (density, temperature) plane.
// Background: log10 M_J; contours every decade; the region where a clump of the chosen mass is
// Jeans-unstable (M > M_J) is highlighted. The marker is draggable and linked to the prose <Var>s jn, jT.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { vars } from '../lib/runtime/vars';
import { jeans } from './star-formation/physics';

const PHASES = [
  { name: 'Warm neutral medium', n: 0.5, T: 8000 },
  { name: 'Cold neutral medium', n: 30, T: 80 },
  { name: 'Giant molecular cloud', n: 200, T: 15 },
  { name: 'Dense core', n: 3e4, T: 10 },
  { name: 'Opacity limit', n: 3e10, T: 10 },
];

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 0.85 : 16 / 10 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1e-2, max: 1e12, log: true, label: 'number density n (cm⁻³)' },
      y: { min: 3, max: 3e4, log: true, label: 'temperature T (K)' },
    });
    const ctx = plot.ctx;
    let n = 1e4, T = 10, Mclump = 1;
    let img: ImageData | null = null, imgKey = '';

    // Colour for log10 M_J: reuse theme series colours as a two-ended ramp (unstable vs stable)
    function heat() {
      const W = Math.max(1, Math.round(plot.pw * plot.dpr)), H = Math.max(1, Math.round(plot.ph * plot.dpr));
      const key = `${W}x${H}:${Mclump}:${pal.accent}:${pal.bg}`;
      if (key === imgKey && img) return img;
      imgKey = key;
      img = ctx.createImageData(W, H);
      const unst = hex(pal.accent), st = hex(pal.series[1]); // orange = collapses, blue = supported
      for (let py = 0; py < H; py++) {
        const Ty = plot.dy(plot.m.t + (py + 0.5) / plot.dpr);
        for (let px = 0; px < W; px++) {
          const nx = plot.dx(plot.m.l + (px + 0.5) / plot.dpr);
          const lr = Math.log10(Mclump / jeans(nx, Ty).MJ); // > 0: unstable
          const a = Math.min(1, Math.abs(lr) / 4) * 0.35 + 0.05;
          const c = lr > 0 ? unst : st;
          const k = (py * W + px) * 4;
          img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = a * 255;
        }
      }
      return img;
    }

    function render() {
      plot.draw(() => {
        const im = heat();
        ctx.putImageData(im, Math.round(plot.m.l * plot.dpr), Math.round(plot.m.t * plot.dpr));
        ctx.setTransform(plot.dpr, 0, 0, plot.dpr, 0, 0);
        // contours of M_J (analytic: straight lines in log–log, T ∝ (M_J² n)^(1/3))
        for (let e = -3; e <= 7; e++) {
          const M = 10 ** e;
          const f = (x: number) => Math.pow((M / jeans(x, 1).MJ) ** 2, 1 / 3);
          plot.fn(f, { color: pal.faint, width: e === 0 ? 1.4 : 0.8, samples: 40 });
          const xl = 3e11; const yl = f(xl); // right edge, clear of the labelled phases
          if (yl > 3 && yl < 3e4) plot.text(`${M >= 1 ? fmt(M) : fmt(M, 1)} M☉`, plot.px(xl), plot.py(yl) - 3, { color: pal.muted, size: 10, align: 'center' });
        }
        // boundary for the chosen clump mass
        plot.fn((x) => Math.pow((Mclump / jeans(x, 1).MJ) ** 2, 1 / 3), { color: pal.accent, width: 2 });
        for (const p of PHASES) plot.point(p.n, p.T, { r: 3, color: pal.fg, label: p.name });
        plot.point(n, T, { r: 7, color: pal.accent2, stroke: pal.fg });
      });
      const j = jeans(n, T);
      ctx.font = `${narrow ? 11 : 12}px JetBrains Mono, ui-monospace, monospace`;
      ctx.fillStyle = pal.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const x0 = plot.px(narrow ? 1e5 : 3e4), y0 = plot.m.t + 8; // top middle: clear of the labelled phases
      [`n = ${fmt(n, 2)} cm⁻³, T = ${fmt(T, 3)} K`, `M_J = ${fmt(j.MJ, 3)} M☉`, `λ_J = ${fmt(j.lambdaPc, 3)} pc`, `t_ff = ${fmt(j.tffMyr, 3)} Myr`,
        Mclump > j.MJ ? `${fmt(Mclump, 3)} M☉ clump: collapses` : `${fmt(Mclump, 3)} M☉ clump: supported`].forEach((s, i) => ctx.fillText(s, x0, y0 + i * (narrow ? 14 : 16)));
    }

    const loop = new Loop(null, render);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onDestroy(onThemeChange(() => { pal = palette(); imgKey = ''; loop.invalidate(); }));

    // drag the marker
    let drag = false;
    const move = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      n = Math.min(1e12, Math.max(1e-2, plot.dx(e.clientX - r.left)));
      T = Math.min(3e4, Math.max(3, plot.dy(e.clientY - r.top)));
      vars.set('jn', +n.toPrecision(3)); vars.set('jT', +T.toPrecision(3));
      loop.invalidate();
    };
    stage.canvas.style.touchAction = 'none';
    stage.canvas.addEventListener('pointerdown', (e) => { drag = true; stage.canvas.setPointerCapture(e.pointerId); move(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (drag) move(e); });
    stage.canvas.addEventListener('pointerup', () => (drag = false));
    onDestroy(vars.subscribe('jn', (v) => { n = v; loop.invalidate(); }));
    onDestroy(vars.subscribe('jT', (v) => { T = v; loop.invalidate(); }));

    const panel = new Panel(host);
    panel.slider('Clump mass', { min: 0.01, max: 1e5, value: Mclump, log: true, unit: 'M☉' }, (v) => { Mclump = v; imgKey = ''; loop.invalidate(); });
    panel.readout('Drag the marker:').set('orange = Jeans-unstable (collapses), blue = supported, for this clump mass');

    return { setVisible: (v) => { loop.setVisible(v); loop.invalidate(); }, destroy: () => loop.destroy() };
  },
});

function hex(css: string): [number, number, number] {
  const m = css.trim().match(/^#([0-9a-f]{6})$/i);
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  const r = css.match(/[\d.]+/g);
  return r ? [+r[0], +r[1], +r[2]] : [200, 120, 60];
}
