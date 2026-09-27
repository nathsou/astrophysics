// Secondary figure: Saha recombination. Ionisation fraction x_e vs redshift/temperature,
// comparing the real baryon-to-photon ratio eta against a hypothetical eta=1 (no photon excess).
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { HBARC_CM, MEV_TO_KELVIN, nGamma } from './big-bang/cosmo';

const B_H = 13.6e-6; // MeV, hydrogen ionisation energy (13.6 eV)
const M_E = 0.5109989; // MeV

/** Saha ionisation fraction for hydrogen recombination, x_e/(1-x_e) = S(T)/n_b, solved for x_e. */
function xe(T_MeV: number, eta: number): number {
  const nb = eta * nGamma(T_MeV);
  // S = (m_e T / 2π)^{3/2} e^{-B/T} in natural units, divided by (ħc)³ to get cm⁻³ (n_e n_p / n_H = S).
  const S = ((M_E * T_MeV) / (2 * Math.PI)) ** 1.5 * Math.exp(-B_H / T_MeV) / (HBARC_CM ** 3);
  // x^2/(1-x) = S/n_b
  const r = S / nb;
  if (!Number.isFinite(r) || r > 1e12) return 1;
  if (r < 1e-12) return Math.sqrt(r); // r -> 0 limit
  return (-r + Math.sqrt(r * r + 4 * r)) / 2;
}

function TforZ(z: number): number {
  return (2.725 * (1 + z)) / MEV_TO_KELVIN;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });

    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1.25'; // taller on phones
    const plot = new Plot(stage.canvas, {
      x: { min: 500, max: 4000, label: 'redshift z   (temperature T = 2.725 K × (1 + z))' },
      y: { min: 1e-4, max: 1.5, log: true, label: 'ionisation fraction xₑ' },
      title: 'Recombination: Saha equation',
    });

    let eta = 6.1e-10;
    const loop = new Loop(null, render, 1 / 30);

    function render() {
      plot.draw(() => {
        plot.fn((z) => xe(TforZ(z), eta), { color: pal.series[0], samples: 200 });
        plot.fn((z) => xe(TforZ(z), 1), { color: pal.series[2], dash: [4, 4], samples: 200 });
        plot.hline(0.5, { color: pal.muted, label: 'xₑ = 1/2' });
      });
      const { ctx } = plot;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.series[0];
      ctx.fillText(`η = ${fmt(eta * 1e10, 2)}×10⁻¹⁰ (real universe)`, plot.m.l + 6, plot.m.t + 14);
      ctx.fillStyle = pal.series[2];
      ctx.fillText('η = 1 (no photon excess)', plot.m.l + 6, plot.m.t + 30);

      // find z where xe crosses 0.5 for the real universe
      const zHalf = (e: number) => { for (let z = 4000; z > 500; z -= 1) if (xe(TforZ(z), e) < 0.5) return z; return NaN; };
      const mark = (z: number, color: string, y: number) => {
        if (!Number.isFinite(z)) return;
        plot.vline(z, { color });
        const txt = `${plot.pw > 420 ? 'xₑ = ½ at ' : ''}z ≈ ${Math.round(z)}, T ≈ ${fmt(TforZ(z) * MEV_TO_KELVIN, 2)} K`;
        ctx.font = '11px Inter, system-ui, sans-serif';
        const w = ctx.measureText(txt).width;
        const X = plot.px(z) + 6 + w > plot.m.l + plot.pw ? plot.px(z) - 6 - w : plot.px(z) + 6;
        ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(txt, X, y);
      };
      mark(zHalf(eta), pal.accent, plot.m.t + plot.ph * 0.55);
      mark(zHalf(1), pal.series[2], plot.m.t + plot.ph * 0.7);
    }

    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    const panel = new Panel(host);
    panel.slider('η (×10⁻¹⁰)', { min: 1, max: 90, value: eta * 1e10, step: 0.1 }, (v) => { eta = v * 1e-10; loop.invalidate(); });

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
