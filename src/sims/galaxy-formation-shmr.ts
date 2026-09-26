// Chapter 23: the stellar-to-halo mass relation (abundance matching; Moster, Naab & White 2013 fit)
//   M*/Mh = 2N [ (Mh/M1)^-β + (Mh/M1)^γ ]^-1, with redshift-dependent parameters.
// Drag across the plot to read off a halo; the redshift slider evolves the fit.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const FB = 0.157;
function moster(Mh: number, z: number) {
  const a = z / (1 + z);
  const M1 = 10 ** (11.59 + 1.195 * a), N = 0.0351 - 0.0247 * a, b = 1.376 - 0.826 * a, g = 0.608 + 0.329 * a;
  return (2 * N) / ((Mh / M1) ** -b + (Mh / M1) ** g);
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let dirty = true;
    const loop = new Loop(null, () => { if (dirty) { dirty = false; render(); } });
    const inv = () => { dirty = true; loop.invalidate(); };
    onThemeChange(() => { pal = palette(); inv(); });
    const stage = createStage(host, { aspect: 16 / 10 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1e9, max: 1e15, log: true, label: 'halo mass M_h (M☉)' },
      y: { min: 1e-4, max: 0.3, log: true, label: 'M★ / M_h' },
    });
    let z = 0, Mh = 1e12;

    function render() {
      plot.draw(() => {
        const c = plot.ctx;
        // shaded regimes
        const band = (x0: number, x1: number, col: string, label: string) => {
          c.fillStyle = col; c.globalAlpha = 0.09;
          c.fillRect(plot.px(x0), plot.m.t, plot.px(x1) - plot.px(x0), plot.ph);
          c.globalAlpha = 1;
          plot.text(label, (plot.px(x0) + plot.px(x1)) / 2, plot.m.t + 14, { align: 'center', color: col, size: 11 });
        };
        band(1e9, 3e11, pal.series[3], 'supernova feedback + reionization');
        band(3e12, 1e15, pal.series[2], 'AGN feedback, long cooling times');
        plot.hline(FB, { label: 'cosmic baryon fraction Ωb/Ωm = 0.157', color: pal.muted });
        plot.fn((m) => moster(m, 0), { color: pal.faint, dash: [4, 4], width: 1.2 });
        plot.fn((m) => moster(m, z), { color: pal.accent, width: 2.4 });
        // Milky Way (M* ≈ 5–6e10, Mh ≈ 1–1.5e12) and M31-ish, rough
        plot.point(1.2e12, 5.5e10 / 1.2e12, { r: 4, color: pal.series[1], label: 'Milky Way' });
        plot.point(1e10, 1e8 / 1e10 * 0.5, { r: 4, color: pal.series[1], label: 'LMC-like dwarf' });
        const f = moster(Mh, z);
        plot.vline(Mh, { color: pal.fg });
        plot.point(Mh, f, { r: 5, color: pal.fg, stroke: pal.accent });
        const eff = f / FB;
        plot.text(`M_h = ${fmt(Mh, 2)} M☉ → M★ = ${fmt(f * Mh, 2)} M☉`, plot.m.l + 10, plot.m.t + plot.ph - 26, { color: pal.fg, size: 12 });
        plot.text(`efficiency M★/(f_b M_h) = ${(100 * eff).toFixed(1)}% of available baryons`, plot.m.l + 10, plot.m.t + plot.ph - 10, { color: pal.muted, size: 12 });
      });
    }
    stage.onResize((w, h, d) => { plot.resize(w, h, d); inv(); });
    const setFromPointer = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      Mh = Math.min(1e15, Math.max(1e9, plot.dx(e.clientX - r.left)));
      inv();
    };
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'ew-resize';
    stage.canvas.addEventListener('pointerdown', (e) => { stage.canvas.setPointerCapture(e.pointerId); setFromPointer(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (stage.canvas.hasPointerCapture(e.pointerId)) setFromPointer(e); });

    const panel = new Panel(host);
    panel.slider('Redshift', { min: 0, max: 4, value: z, step: 0.1 }, (v) => { z = v; inv(); });
    panel.button('Dwarf (10¹⁰)', () => { Mh = 1e10; inv(); });
    panel.button('Milky Way (10¹²)', () => { Mh = 1e12; inv(); });
    panel.button('Cluster (10¹⁴·⁵)', () => { Mh = 3e14; inv(); });
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
