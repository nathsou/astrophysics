// Appendix A9: photon energy E = hc/λ across the whole electromagnetic spectrum.
// A log–log plot (a straight line of slope −1), with the named bands shaded, reference
// energies marked, and a draggable wavelength marker with live readouts.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { narrowAspect } from './primer-common/stack';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { wavelengthRGB } from '../lib/physics/blackbody';
import { h, c } from '../lib/physics/constants';

const HC_EV_NM = 1239.84193; // hc in eV·nm
const eV = 1.602176634e-19;

const BANDS: [string, number, number][] = [
  // name, λ_min (m), λ_max (m)
  ['γ-ray', 1e-14, 1e-11],
  ['X-ray', 1e-11, 1e-8],
  ['UV', 1e-8, 3.8e-7],
  ['', 3.8e-7, 7.5e-7],
  ['infrared', 7.5e-7, 1e-3],
  ['microwave', 1e-3, 0.1],
  ['radio', 0.1, 100],
];

const REFS: [string, number][] = [
  ['electron rest energy 511 keV', 511e3],
  ['hydrogen ionisation 13.6 eV', 13.6],
  ['chemical bond ≈ 4 eV', 4],
  ['thermal kT at 300 K = 0.026 eV', 0.0259],
  ['CMB photon (typical) ≈ 0.6 meV', 6.3e-4],
  ['21 cm line 5.9 μeV', 5.87e-6],
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });

    narrowAspect(stage, 16 / 9, 0.95);
    const plot = new Plot(stage.canvas, {
      x: { min: 1e-14, max: 100, log: true, label: 'wavelength λ (m)' },
      y: { min: 1e-8, max: 1e8, log: true, label: 'photon energy E (eV)' },
      margin: { l: 58, r: 16, t: 34, b: 42 },
    });
    let lam = 5.5e-7; // m

    const loop = new Loop(null, render);

    loop.onDemand = true;

    function render() {
      const { ctx } = plot;
      plot.draw(() => {
        const top = plot.m.t, bot = plot.m.t + plot.ph;
        // bands
        BANDS.forEach(([name, a, b], i) => {
          const X0 = plot.px(a), X1 = plot.px(b);
          if (name === '') {
            // visible: a real rainbow
            const g = ctx.createLinearGradient(X0, 0, X1, 0);
            for (let nm = 380; nm <= 750; nm += 20) {
              const [r, gg, bb] = wavelengthRGB(nm).map((v) => Math.max(0, Math.min(1, v)) * 255);
              g.addColorStop((Math.log(nm / 380) / Math.log(750 / 380)), `rgba(${r | 0},${gg | 0},${bb | 0},0.55)`);
            }
            ctx.fillStyle = g;
          } else {
            ctx.fillStyle = i % 2 ? pal.grid : 'transparent';
          }
          ctx.fillRect(X0, top, X1 - X0, bot - top);
          // band names only where they fit (the narrow bands crowd together on a phone)
          if (name && X1 - X0 > name.length * 6.5 + 6) plot.text(name, (X0 + X1) / 2, bot - 6, { align: 'center', color: pal.muted, size: 11 });
        });
        // reference energies
        for (const [label, E] of REFS) {
          plot.hline(E, { color: pal.faint });
          plot.text(label, plot.m.l + plot.pw - 4, plot.py(E) - 3, { align: 'right', color: pal.muted, size: 10 });
        }
        // E = hc/λ
        plot.fn((l) => HC_EV_NM / (l * 1e9), { color: pal.accent, width: 2 });
        const E = HC_EV_NM / (lam * 1e9);
        plot.vline(lam, { color: pal.accent2 });
        plot.point(lam, E, { r: 6, color: pal.accent2, stroke: pal.fg });
      });
      plot.text('drag across the plot to choose a wavelength', plot.m.l, 18, { color: pal.muted, size: 11 });
      updateReadouts();
    }

    stage.onResize((w, hh, d) => { plot.resize(w, hh, d); loop.invalidate(); });

    // pointer: drag to set λ
    const cv = stage.canvas;
    cv.style.touchAction = 'none';
    cv.style.cursor = 'ew-resize';
    let dragging = false;
    const setFromEvent = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const X = Math.max(plot.m.l, Math.min(plot.m.l + plot.pw, e.clientX - r.left));
      lam = plot.dx(X);
      slider.set(lam);
      loop.invalidate();
    };
    cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); setFromEvent(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e); });
    cv.addEventListener('pointerup', () => (dragging = false));
    cv.addEventListener('pointercancel', () => (dragging = false));

    const fmtLen = (l: number) =>
      l >= 1 ? `${fmt(l, 3)} m` : l >= 1e-3 ? `${fmt(l * 1e3, 3)} mm` : l >= 1e-6 ? `${fmt(l * 1e6, 3)} μm` : l >= 1e-9 ? `${fmt(l * 1e9, 3)} nm` : `${fmt(l * 1e12, 3)} pm`;
    const fmtE = (E: number) =>
      E >= 1e6 ? `${fmt(E / 1e6, 3)} MeV` : E >= 1e3 ? `${fmt(E / 1e3, 3)} keV` : E >= 1 ? `${fmt(E, 3)} eV` : E >= 1e-3 ? `${fmt(E * 1e3, 3)} meV` : `${fmt(E * 1e6, 3)} μeV`;
    const fmtHz = (f: number) =>
      f >= 1e12 ? `${fmt(f, 3)} Hz` : f >= 1e9 ? `${fmt(f / 1e9, 3)} GHz` : `${fmt(f / 1e6, 3)} MHz`;

    const panel = new Panel(host);
    const slider = panel.slider('Wavelength', { min: 1e-14, max: 100, value: lam, log: true, format: fmtLen }, (v) => { lam = v; loop.invalidate(); });
    panel.button('Green light', () => { lam = 5.5e-7; slider.set(lam); loop.invalidate(); });
    panel.button('Hα', () => { lam = 656.3e-9; slider.set(lam); loop.invalidate(); });
    panel.button('Medical X-ray', () => { lam = 2e-11; slider.set(lam); loop.invalidate(); });
    panel.button('21 cm', () => { lam = 0.211; slider.set(lam); loop.invalidate(); });
    const rE = panel.readout('E =');
    const rf = panel.readout('ν =');
    const rN = panel.readout('Photons per second in 1 W:');

    function updateReadouts() {
      const EJ = (h * c) / lam, EeV = EJ / eV;
      rE.set(`${fmtE(EeV)} = ${fmt(EJ, 3)} J`);
      rf.set(fmtHz(c / lam));
      rN.set(fmt(1 / EJ, 3));
    }

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
