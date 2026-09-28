// Chapter 6 secondary figure: dust extinction and reddening. A star's blackbody spectrum,
// attenuated by exp(-tau(lambda)) through a dust column of visual extinction A_V, using a
// simple power-law-ish extinction curve normalised to R_V ≈ 3.1. Shows the spectrum before/after,
// the extinction curve A(λ)/A_V, and the resulting apparent colour swatch.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { planckLambda, blackbodyCSS, cieXYZ, xyzToLinearRGB } from '../lib/physics/blackbody';

// Simple analytic stand-in for a Cardelli/Fitzpatrick-like Milky Way extinction curve, normalised
// so A(V, 550nm)=1. Roughly A(λ) ∝ λ^-1.6 in the optical/NIR, steepening into the UV; R_V = 3.1.
function extinctionShape(nm: number): number {
  const um = nm / 1000;
  if (um >= 0.35) return (0.55 / um) ** 1.61; // optical–NIR, ~1/λ
  // crude UV rise (bump-free simplification)
  return (0.55 / 0.35) ** 1.61 * (0.35 / um) ** 0.9;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)'};gap:0`;
    host.append(wrap);
    const plotStage = createStage(wrap, { aspect: 16 / 10 });
    const swatchStage = createStage(wrap, { aspect: 16 / 10 });
    plotStage.el.style[narrow ? 'borderBottom' : 'borderRight'] = '1px solid var(--rule)';

    const plot = new Plot(plotStage.canvas, {
      x: { min: 200, max: 2400, log: true, label: 'wavelength (nm)', ticks: [300, 500, 1000, 2000], format: (v) => String(v) },
      y: { min: 0, max: 1, label: 'relative flux' },
      title: 'Spectrum before / after dust',
    });

    let T = 9000, Av = 1.0;
    const ctx = swatchStage.canvas.getContext('2d')!;

    function attenuatedRGB(T: number, Av: number): [number, number, number] {
      let X = 0, Y = 0, Z = 0;
      for (let nm = 380; nm <= 780; nm += 5) {
        const A = Av * extinctionShape(nm);
        const B = planckLambda(nm * 1e-9, T) * 10 ** (-0.4 * A);
        const [x, y, z] = cieXYZ(nm);
        X += B * x; Y += B * y; Z += B * z;
      }
      let [r, g, b] = xyzToLinearRGB(X, Y, Z);
      r = Math.max(r, 0); g = Math.max(g, 0); b = Math.max(b, 0);
      const m = Math.max(r, g, b) || 1;
      const toS = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);
      return [toS(r / m), toS(g / m), toS(b / m)];
    }

    function render() {
      // reference peak for normalisation (unattenuated)
      let peak = 0;
      for (let nm = 200; nm <= 2400; nm += 10) peak = Math.max(peak, planckLambda(nm * 1e-9, T));

      plot.draw(() => {
        plot.fn((nm) => planckLambda(nm * 1e-9, T) / peak, { color: pal.faint, dash: [3, 3] });
        plot.fn((nm) => (planckLambda(nm * 1e-9, T) * 10 ** (-0.4 * Av * extinctionShape(nm))) / peak, { color: pal.accent, width: 2.25 });
        plot.vline(550, { color: pal.muted, label: 'V (550 nm)' });
      });
      plot.text('— dimmed & reddened', plot.m.l + plot.pw - 10, plot.py(0.72), { color: pal.accent, size: 11, align: 'right' });
      plot.text('┄ without dust', plot.m.l + plot.pw - 10, plot.py(0.72) + 16, { color: pal.muted, size: 11, align: 'right' });

      const { width: W, height: H, dpr } = swatchStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const r = Math.min(W, H) * 0.24;
      // true colour (unattenuated)
      ctx.fillStyle = blackbodyCSS(T);
      ctx.beginPath(); ctx.arc(W * 0.3, H * 0.42, r, 0, Math.PI * 2); ctx.fill();
      // reddened colour
      const [rr, gg, bb] = attenuatedRGB(T, Av);
      ctx.fillStyle = `rgb(${(rr * 255) | 0},${(gg * 255) | 0},${(bb * 255) | 0})`;
      ctx.beginPath(); ctx.arc(W * 0.68, H * 0.42, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.muted;
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('true colour', W * 0.3, H * 0.42 + r + 18);
      ctx.fillText('as observed', W * 0.68, H * 0.42 + r + 18);
      const EBV = Av / 3.1;
      ctx.fillStyle = pal.fg;
      ctx.fillText(`A_V = ${fmt(Av, 3)} mag   E(B−V) = ${fmt(EBV, 3)} mag   R_V = 3.1`, W / 2, H - 16);
      ctx.textAlign = 'left';
    }

    const loop = new Loop(null, render, 1 / 20);
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    swatchStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Star temperature T', { min: 3000, max: 30000, value: T, log: true, step: 1, format: (v) => `${fmt(v, 4)} K` }, (v) => { T = v; loop.invalidate(); });
    panel.slider('Extinction A_V', { min: 0, max: 8, value: Av, step: 0.02, format: (v) => `${fmt(v, 3)} mag` }, (v) => { Av = v; loop.invalidate(); });

    loop.setVisible(true);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
