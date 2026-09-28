// Secondary figure: degeneracy pressure vs ideal-gas pressure as a function of electron density,
// with a Fermi-sphere cartoon. Pauli exclusion packs electrons into a sphere in momentum space of
// radius p_F = ħ(3π²n)^{1/3}; the resulting pressure is set by density alone, not temperature.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt, superscript } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { hbar, me, c, kB } from '../lib/physics/constants';

const pF = (n: number) => hbar * (3 * Math.PI * Math.PI * n) ** (1 / 3);
// Non-relativistic degenerate electron pressure: P = (ħ²/5me)(3π²)^{2/3} n^{5/3}
const Pdeg = (n: number) => (hbar * hbar / (5 * me)) * (3 * Math.PI * Math.PI) ** (2 / 3) * n ** (5 / 3);
const Pideal = (n: number, T: number) => n * kB * T;

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr);gap:0;';
    host.append(wrap);
    const sphereStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 / 0.92 });
    sphereStage.el.style.borderRight = '1px solid var(--rule)';
    // side by side on wide screens, stacked on phones
    const stackRO = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,0.8fr) minmax(0,1.2fr)';
      sphereStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      sphereStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    stackRO.observe(wrap);
    onDestroy(() => stackRO.disconnect());
    const sctx = sphereStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: 1e28, max: 1e36, log: true, label: 'electron number density n (m⁻³)' },
      y: { min: 1e10, max: 1e28, log: true, label: 'pressure P (Pa)' },
      title: 'Degenerate vs ideal-gas pressure',
    });
    let n = 1e33; // ~ white dwarf core, m^-3
    let T = 1e7; // K

    const panel = new Panel(host);
    const roPf = panel.readout('Fermi momentum p_F');
    const roEf = panel.readout('Fermi energy E_F');
    const roRatio = panel.readout('β = p_F / mₑc');
    panel.slider('Electron density n', { min: 1e28, max: 1e37, value: n, log: true, format: (v) => v.toExponential(2) }, (v) => { n = v; draw(); });
    panel.slider('Temperature T', { min: 1e4, max: 1e9, value: T, log: true, unit: 'K', format: (v) => v.toExponential(1) }, (v) => { T = v; draw(); });

    function draw() {
      const p = pF(n), beta = p / (me * c);
      const Ef = Math.sqrt((p * c) ** 2 + (me * c * c) ** 2) - me * c * c;
      roPf.set(`${fmt(p, 3)} kg·m/s`);
      roEf.set(`${fmt(Ef / 1.602176634e-19 / 1000, 3)} keV`);
      roRatio.set(fmt(beta, 3) + (beta > 0.3 ? '  (mildly relativistic)' : '  (non-relativistic)'));

      // Fermi sphere cartoon: filled sphere in momentum space, radius scaled to panel, with a
      // faint "thermal skin" of width ~ kT/E_F showing how little a normal gas would smear it.
      const { width: W, height: H, dpr } = sphereStage;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, Rmax = Math.min(W, H) * 0.38;
      const rr = Rmax * 0.75; // fixed visual radius; density is conveyed by readouts, not area
      const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, pal.accent2);
      grad.addColorStop(1, pal.accent);
      sctx.globalAlpha = 0.85;
      sctx.fillStyle = grad;
      sctx.beginPath(); sctx.arc(cx, cy, rr, 0, Math.PI * 2); sctx.fill();
      sctx.globalAlpha = 1;
      sctx.strokeStyle = pal.fg;
      sctx.lineWidth = 1.5;
      sctx.beginPath(); sctx.arc(cx, cy, rr, 0, Math.PI * 2); sctx.stroke();
      // thermal skin thickness ~ kT/E_F of the radius (visually exaggerated but monotonic)
      const skin = Math.min(0.4, (kB * T) / Math.max(Ef, 1e-25)) * rr;
      if (skin > 1) {
        sctx.strokeStyle = pal.bad;
        sctx.setLineDash([3, 3]);
        sctx.beginPath(); sctx.arc(cx, cy, rr - skin / 2, 0, Math.PI * 2); sctx.stroke();
        sctx.setLineDash([]);
      }
      sctx.fillStyle = pal.fg;
      sctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      sctx.textAlign = 'center';
      sctx.fillText('p_F', cx, cy - rr - 8);
      sctx.fillStyle = pal.muted;
      sctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      sctx.fillText('filled Fermi sphere', cx, H - 14);
      sctx.fillText('(dashed = thermal smearing kT/E_F)', cx, H - 2);

      plot.draw(() => {
        plot.fn(Pdeg, { color: pal.series[0], width: 2.25 });
        for (const [Ti, col] of [[1e5, pal.series[3]], [1e7, pal.series[2]], [1e9, pal.series[1]]] as const) {
          plot.fn((n_) => Pideal(n_, Ti), { color: col, dash: [5, 4] });
          plot.text(`10${superscript(String(Math.log10(Ti)))} K`, plot.px(1.6e28), plot.py(Pideal(1.6e28, Ti)) - 7, { color: col, size: 10.5, align: 'left' });
        }
        plot.fn((n_) => Pideal(n_, T), { color: pal.fg, dash: [2, 3], alpha: 0.55 });
        plot.point(n, Math.max(Pdeg(n), Pideal(n, T)), { r: 5, color: pal.accent, stroke: pal.fg });
        plot.text('solid: degenerate P(n) ∝ n^(5/3), T-independent', plot.m.l + 8, plot.m.t + 14, { color: pal.series[0], size: 10.5 });
        plot.text('dashed: ideal gas at 10⁵, 10⁷, 10⁹ K; dotted: your T', plot.m.l + 8, plot.m.t + 28, { color: pal.muted, size: 10.5 });
      });
    }
    sphereStage.onResize(() => draw());
    plotStage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); draw(); });
    onThemeChange(() => { pal = palette(); draw(); });

    return { setVisible() {}, destroy() {} };
  },
});
