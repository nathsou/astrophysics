// Chapter 18 secondary figure: neutron-star mass–radius curves for a few illustrative parametrised
// equations of state (soft/medium/stiff — NOT full TOV solutions, just curves shaped like them),
// with NICER pulse-profile mass–radius constraints, the 2 M☉+ pulsar mass measurements, and a
// to-scale neutron-star-vs-city comparison panel driven by the selected point on the curve.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

interface EOS { label: string; Mmax: number; R14: number; Rlow: number; color: 'accent' | 'accent2' | 'accent3' }
const EOS_LIST: EOS[] = [
  { label: 'Soft', Mmax: 1.95, R14: 10.6, Rlow: 11.1, color: 'accent2' },
  { label: 'Medium', Mmax: 2.15, R14: 12.2, Rlow: 12.6, color: 'accent' },
  { label: 'Stiff', Mmax: 2.35, R14: 13.6, Rlow: 13.8, color: 'accent3' },
];
// R(M): near-flat plateau then a steep turn-down to zero at Mmax (schematic, calibrated to hit R(1.4)).
function radiusOf(eos: EOS, M: number): number {
  if (M >= eos.Mmax) return NaN;
  const x = M / eos.Mmax;
  const plateau = eos.Rlow - (eos.Rlow - eos.R14) * Math.min(1, M / 1.4) ** 0.7;
  const turn = Math.pow(1 - x, 0.22);
  return plateau * turn + 0.15;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);';
    host.append(wrap);
    const plotStage = createStage(wrap, { aspect: 1.15 });
    const cityStage = createStage(wrap, { aspect: 1 / 0.92 });
    plotStage.el.style.borderRight = '1px solid var(--rule)';
    const cctx = cityStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: 8, max: 16, label: 'radius R (km)' },
      y: { min: 0.5, max: 2.6, label: 'mass M (M☉)' },
      title: 'Mass–radius curves (illustrative EOS)',
    });

    let eosIdx = 1;
    let M = 1.4;

    const loop = new Loop(null, render, 1 / 30);

    function render() {
      const { width: W, height: H, dpr } = plotStage;
      plot.resize(W, H, dpr);
      plot.draw(() => {
        for (const eos of EOS_LIST) {
          const xs: number[] = [], ys: number[] = [];
          for (let m = 0.5; m < eos.Mmax; m += 0.01) { xs.push(radiusOf(eos, m)); ys.push(m); }
          plot.line(xs, ys, { color: pal[eos.color], width: eos.label === EOS_LIST[eosIdx].label ? 2.5 : 1.3, alpha: eos.label === EOS_LIST[eosIdx].label ? 1 : 0.45 });
          plot.text(eos.label, plot.px(radiusOf(eos, eos.Mmax * 0.55)) , plot.py(eos.Mmax * 0.55) - 6, { color: pal[eos.color], size: 10 });
          plot.hline(eos.Mmax, { color: pal[eos.color], dash: [2, 3], alpha: 0.5 });
        }
        // NICER constraints (Miller et al. 2019/2021, illustrative error bars)
        const nicer = [
          { M: 1.34, R: 12.71, dM: 0.15, dR: 1.19, label: 'PSR J0030+0451' },
          { M: 2.08, R: 12.39, dM: 0.07, dR: 1.3, label: 'PSR J0740+6620' },
        ];
        for (const n of nicer) {
          plot.line([n.R - n.dR, n.R + n.dR], [n.M, n.M], { color: pal.good, width: 1.5 });
          plot.line([n.R, n.R], [n.M - n.dM, n.M + n.dM], { color: pal.good, width: 1.5 });
          plot.point(n.R, n.M, { r: 4, color: pal.good, label: n.label });
        }
        // GW170817 tidal-deformability band at 1.4 M☉
        plot.line([9, 13.6], [1.4, 1.4], { color: pal.bad, width: 4, alpha: 0.18 });
        plot.text('GW170817: R(1.4M☉) ≲ 13.6 km', plot.px(9), plot.py(1.4) + 14, { color: pal.bad, size: 10 });
        // current selection
        const R = radiusOf(EOS_LIST[eosIdx], M);
        if (Number.isFinite(R)) plot.point(R, M, { r: 6, color: pal.fg, stroke: pal[EOS_LIST[eosIdx].color] });
      });

      // city-size comparison
      const { width: CW, height: CH, dpr: cdpr } = cityStage;
      cctx.setTransform(cdpr, 0, 0, cdpr, 0, 0);
      cctx.clearRect(0, 0, CW, CH);
      const R = radiusOf(EOS_LIST[eosIdx], M);
      const Rkm = Number.isFinite(R) ? R : 12;
      // Manhattan, schematically: ~21 km long, ~3.7 km wide island outline
      const scale = Math.min(CW, CH) / 26;
      const ox = CW / 2 - 8 * scale, oy = CH / 2;
      cctx.fillStyle = pal.faint; cctx.globalAlpha = 0.35;
      cctx.beginPath();
      const shape: [number, number][] = [[0, -1.6], [1, -1.9], [2, -1.6], [3.2, 0], [2.6, 1.2], [1.2, 1.9], [-0.5, 1.7], [-1, 0.4]];
      shape.forEach(([x, y], i) => { const X = ox + x * scale, Y = oy + y * scale; i ? cctx.lineTo(X, Y) : cctx.moveTo(X, Y); });
      cctx.closePath(); cctx.fill(); cctx.globalAlpha = 1;
      cctx.fillStyle = pal.muted; cctx.font = '11px Inter, system-ui, sans-serif';
      cctx.fillText('Manhattan (≈21 km long)', ox - 1.2 * scale, oy - 2.2 * scale);

      const nsx = ox + 9 * scale, nsy = oy;
      const g = cctx.createRadialGradient(nsx, nsy, 0, nsx, nsy, Rkm * scale);
      g.addColorStop(0, '#eaf3ff'); g.addColorStop(0.6, pal.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
      cctx.fillStyle = g;
      cctx.beginPath(); cctx.arc(nsx, nsy, Rkm * scale, 0, Math.PI * 2); cctx.fill();
      cctx.strokeStyle = pal.fg; cctx.lineWidth = 1; cctx.beginPath(); cctx.arc(nsx, nsy, Rkm * scale, 0, Math.PI * 2); cctx.stroke();
      cctx.fillStyle = pal.fg;
      cctx.fillText(`neutron star, R ≈ ${fmt(Rkm, 3)} km`, nsx - 55, nsy + Rkm * scale + 16);
      cctx.fillText(`M ≈ ${fmt(M, 3)} M☉`, nsx - 30, nsy + Rkm * scale + 30);
      // scale bar
      cctx.strokeStyle = pal.muted; cctx.beginPath();
      cctx.moveTo(14, CH - 16); cctx.lineTo(14 + 10 * scale, CH - 16); cctx.stroke();
      cctx.fillText('10 km', 14, CH - 20);

      mOut.set(`${fmt(M, 3)} M☉`);
      rOut.set(Number.isFinite(R) ? `${fmt(R, 4)} km` : 'above M_max — collapses');
      const rho = Number.isFinite(R) ? (M * 1.98847e30) / ((4 / 3) * Math.PI * (R * 1000) ** 3) : NaN;
      rhoOut.set(Number.isFinite(rho) ? `${fmt(rho, 3)} kg/m³` : '—');
    }

    plotStage.onResize(() => loop.invalidate());
    cityStage.onResize(() => loop.invalidate());

    const el = plotStage.canvas;
    el.style.cursor = 'pointer';
    el.addEventListener('pointerdown', (e) => {
      const b = el.getBoundingClientRect();
      const my = plot.dy(e.clientY - b.top);
      if (my > 0.5 && my < EOS_LIST[eosIdx].Mmax) { M = my; loop.invalidate(); }
    });

    const panel = new Panel(host);
    panel.select('Equation of state', EOS_LIST.map((e, i) => ({ value: String(i), label: `${e.label} (M_max=${e.Mmax} M☉)` })), String(eosIdx), (v) => { eosIdx = +v; M = Math.min(M, EOS_LIST[eosIdx].Mmax - 0.05); loop.invalidate(); });
    panel.slider('Mass M', { min: 0.5, max: 2.5, value: M, step: 0.01, unit: 'M☉' }, (v) => { M = Math.min(v, EOS_LIST[eosIdx].Mmax - 0.02); loop.invalidate(); });
    const mOut = panel.readout('M =');
    const rOut = panel.readout('R =');
    const rhoOut = panel.readout('mean ρ =');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
