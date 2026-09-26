// Chapter 4, figure: the ultraviolet catastrophe. Classical mode-counting (Rayleigh–Jeans)
// predicts infinite energy in short-wavelength cavity modes; Planck's quantised modes do not.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { planckLambda } from '../lib/physics/blackbody';
import { rayleighJeansLambda } from './light/spectrum';
import { c as cLight, kB } from '../lib/physics/constants';

const NM = 1e-9;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 10, max: 1e5, log: true, label: 'wavelength λ (nm)' },
      y: { min: 1e-6, max: 1, log: true, label: 'B_λ (W sr⁻¹ m⁻³)' },
      title: 'Classical modes vs. Planck',
    });

    let T = 5000;
    let lamMinNm = 200;

    function rescale() {
      const peak = planckLambda(2.898e-3 / T, T);
      plot.o.y.min = peak * 1e-8; plot.o.y.max = peak * 20;
    }
    rescale();

    function render() {
      const lamMin = lamMinNm * NM;
      // classical (Rayleigh–Jeans) energy in modes with λ < λ_min diverges as λ_min → 0:
      // ∫_0^{λmin} 2πc kT / λ^4 dλ diverges at the lower limit; the *finite, physical* quantity is
      // the energy ABOVE the cutoff going the other way is fine — the catastrophe is the number of
      // modes as λ → 0 (ν → ∞). We show the closed-form classical energy density integrated from
      // λ_min to a fixed reference λ_ref, which blows up as λ_min shrinks:
      const classicalBelow = (2 * cLight * kB * T) / (3 * lamMin ** 3); // ∝ λmin⁻³ → ∞

      plot.draw(() => {
        const { ctx } = plot;
        // shade the "UV" region below the cutoff
        ctx.fillStyle = pal.bad;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(plot.m.l, plot.m.t, plot.px(lamMinNm) - plot.m.l, plot.ph);
        ctx.globalAlpha = 1;
        plot.fn((nmv) => rayleighJeansLambda(nmv * NM, T), { color: pal.bad, dash: [5, 3], width: 1.8 });
        plot.fn((nmv) => planckLambda(nmv * NM, T), { color: pal.accent, width: 2.2 });
        plot.vline(lamMinNm, { color: pal.fg, label: 'λ_min' });
      });

      panel2.set(
        `Classical energy density with λ < λ_min: ${classicalBelow > 1e6 ? classicalBelow.toExponential(2) : fmt(classicalBelow, 3)} W sr⁻¹ m⁻² — grows without bound as λ_min → 0 (⁠∝ λ_min⁻³). Planck's curve stays finite because ⟨E⟩ per mode → 0 exponentially once hν ≫ k_BT.`,
      );
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('Temperature', { min: 300, max: 40000, value: T, log: true, unit: 'K' }, (v) => { T = v; rescale(); loop.invalidate(); });
    panel.slider('λ_min cutoff', { min: 10, max: 2000, value: lamMinNm, log: true, unit: 'nm' }, (v) => { lamMinNm = v; loop.invalidate(); });
    const panel2 = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
