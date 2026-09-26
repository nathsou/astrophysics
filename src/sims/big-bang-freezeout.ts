// Secondary figure: the freeze-out rule Γ vs H, and the n/p ratio it produces.
// Left panel: interaction rate Γ (draggable cross-section normalisation) vs the Hubble rate H,
// both vs temperature; freeze-out is where they cross. Right panel: the resulting n/p ratio,
// equilibrium vs the frozen-out + decaying value.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { DELTA_M, TAU_N, hubble, timeAtT } from './big-bang/cosmo';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    const leftStage = createStage(wrap, { aspect: 1 });
    const rightStage = createStage(wrap, { aspect: 1 });
    leftStage.el.style.borderRight = '1px solid var(--rule)';

    const plotGH = new Plot(leftStage.canvas, {
      x: { min: 0.1, max: 10, log: true, label: 'T (MeV)' },
      y: { min: 1e-3, max: 1e4, log: true, label: 'rate (s⁻¹)' },
      title: 'Γ vs H',
    });
    const plotNP = new Plot(rightStage.canvas, {
      x: { min: 0.1, max: 10, log: true, label: 'T (MeV)' },
      y: { min: 0.05, max: 1.1, label: 'n / p' },
      title: 'Neutron-to-proton ratio',
    });

    let sigmaScale = 1; // multiplies the weak rate normalisation (draggable "cross-section")

    function Gamma(T: number): number {
      const Tf = 0.8;
      const G0 = hubble(Tf) * sigmaScale;
      return G0 * (T / Tf) ** 5;
    }
    function freezeOutT(): number {
      // solve Gamma(T) = H(T) by bisection (both monotonic in T)
      let lo = 0.05, hi = 20;
      for (let i = 0; i < 60; i++) {
        const mid = Math.sqrt(lo * hi);
        if (Gamma(mid) > hubble(mid)) hi = mid; else lo = mid;
      }
      return Math.sqrt(lo * hi);
    }
    function npRatio(T: number, Tf: number): number {
      const npEq = Math.exp(-DELTA_M / T);
      if (T > Tf) return npEq; // n/p in full equilibrium
      const npAtFreeze = Math.exp(-DELTA_M / Tf);
      const tFreeze = timeAtT(Tf);
      const t = timeAtT(T);
      const nFrac0 = npAtFreeze / (1 + npAtFreeze);
      // free decay of the neutron fraction (protons produced are not re-destroyed on these timescales)
      const nFrac = nFrac0 * Math.exp(-(t - tFreeze) / TAU_N);
      const pFrac = 1 - nFrac0 + nFrac0 * (1 - Math.exp(-(t - tFreeze) / TAU_N));
      return nFrac / pFrac;
    }

    const loop = new Loop(null, render, 1 / 30);

    function render() {
      const Tf = freezeOutT();
      plotGH.draw(() => {
        plotGH.fn((T) => hubble(T), { color: pal.series[1] });
        plotGH.fn((T) => Gamma(T), { color: pal.series[0] });
        plotGH.vline(Tf, { color: pal.accent, label: `T_f ≈ ${fmt(Tf, 2)} MeV` });
      });
      const { ctx } = plotGH;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.series[1]; ctx.fillText('H(T)', plotGH.m.l + 6, plotGH.m.t + 14);
      ctx.fillStyle = pal.series[0]; ctx.fillText('Γ(T) (weak n↔p)', plotGH.m.l + 6, plotGH.m.t + 30);

      plotNP.draw(() => {
        plotNP.fn((T) => Math.exp(-DELTA_M / T), { color: pal.muted, dash: [3, 3] });
        plotNP.fn((T) => npRatio(T, Tf), { color: pal.series[0] });
        plotNP.hline(1 / 6, { color: pal.accent2, label: '1/6' });
        plotNP.hline(1 / 7, { color: pal.accent3 ?? pal.good, label: '1/7' });
      });
      const { ctx: c2 } = plotNP;
      c2.fillStyle = pal.muted; c2.font = '11px Inter, system-ui, sans-serif';
      c2.fillText('dashed: equilibrium n/p = e^(−Δm/T)', plotNP.m.l + 6, plotNP.m.t + 14);
    }

    leftStage.onResize((w, h, d) => { plotGH.resize(w, h, d); loop.invalidate(); });
    rightStage.onResize((w, h, d) => { plotNP.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('Weak cross-section (× standard)', { min: 0.1, max: 10, value: sigmaScale, log: true, step: 0.01 }, (v) => { sigmaScale = v; loop.invalidate(); });
    const ro = panel.readout('Freeze-out temperature:');
    const update = () => ro.set(`${fmt(freezeOutT(), 3)} MeV`);
    update();
    const origInvalidate = loop.invalidate.bind(loop);
    loop.invalidate = () => { update(); origInvalidate(); };

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
