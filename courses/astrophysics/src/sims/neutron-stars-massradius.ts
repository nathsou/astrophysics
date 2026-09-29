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
// R(M) along the stable branch: a sqrt turn-over at M_max (where dM/dR = 0, as for a real TOV curve),
// calibrated so that R(1.4 M☉) = R14 exactly, plus a gentle swell at low mass. Schematic, not a solution.
function radiusOf(eos: EOS, M: number): number {
  if (M >= eos.Mmax) return NaN;
  const Rtop = eos.R14 - 1.3; // radius at the maximum mass
  const low = (m: number) => (eos.Rlow - eos.R14) * Math.max(0, (1.4 - m) / 0.9) ** 2;
  const c = (eos.R14 - Rtop) / Math.sqrt(1 - 1.4 / eos.Mmax);
  return Rtop + c * Math.sqrt(1 - M / eos.Mmax) + low(M);
}

// Manhattan island outline in km: a spine 21.6 km long, up to 3.7 km wide, tilted ~29° east of north.
const MANHATTAN: [number, number][] = (() => {
  const L = 21.6, N = 24, pts: [number, number][] = [];
  const half = (s: number) => 1.85 * Math.pow(Math.sin((Math.PI * s) / L), 0.55) * (0.75 + 0.25 * s / L);
  for (let i = 0; i <= N; i++) { const s = (L * i) / N; pts.push([s - L / 2, half(s)]); }
  for (let i = N; i >= 0; i--) { const s = (L * i) / N; pts.push([s - L / 2, -half(s)]); }
  const a = (61 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  return pts.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
})();

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);';
    host.append(wrap);
    const plotStage = createStage(wrap, { aspect: 1.15 });
    const cityStage = createStage(wrap, { aspect: 1 / 0.92 });
    plotStage.el.style.borderRight = '1px solid var(--rule)';
    // side by side on wide screens, stacked on phones
    const stackRO = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)';
      plotStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      plotStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    stackRO.observe(wrap);
    onDestroy(() => stackRO.disconnect());
    const cctx = cityStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: 8, max: 16, label: 'radius R (km)' },
      y: { min: 0.5, max: 2.6, label: 'mass M (M☉)' },
      title: 'Mass–radius curves (illustrative EOS)',
    });

    let eosIdx = 1;
    let M = 1.4;

    const loop = new Loop(null, render, 1 / 30);

    loop.onDemand = true;

    function render() {
      const { width: W, height: H, dpr } = plotStage;
      plot.resize(W, H, dpr);
      plot.draw(() => {
        for (const eos of EOS_LIST) {
          const xs: number[] = [], ys: number[] = [];
          for (let m = 0.5; m < eos.Mmax; m += 0.01) { xs.push(radiusOf(eos, m)); ys.push(m); }
          plot.line(xs, ys, { color: pal[eos.color], width: eos.label === EOS_LIST[eosIdx].label ? 2.5 : 1.3, alpha: eos.label === EOS_LIST[eosIdx].label ? 1 : 0.45 });
          plot.text(eos.label, plot.px(radiusOf(eos, 0.75)) + 5, plot.py(0.75), { color: pal[eos.color], size: 10, align: 'left' });
          plot.hline(eos.Mmax, { color: pal[eos.color], dash: [2, 3], alpha: 0.5, label: `M_max (${eos.label.toLowerCase()})` });
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
        plot.text('GW170817: R(1.4 M☉) ≲ 13.6 km', plot.px(8.15), plot.py(1.4) - 8, { color: pal.bad, size: 10, align: 'left' });
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
      // Neutron star to scale, with Manhattan laid over it (same scale).
      const scale = Math.min(CW, CH - 40) / 30; // px per km
      const nsx = CW / 2, nsy = (CH - 40) / 2 + 30;
      const g = cctx.createRadialGradient(nsx, nsy, 0, nsx, nsy, Rkm * scale);
      g.addColorStop(0, '#f4f8ff'); g.addColorStop(0.55, '#9cc3ff'); g.addColorStop(1, '#3d6fd0');
      cctx.fillStyle = g;
      cctx.beginPath(); cctx.arc(nsx, nsy, Rkm * scale, 0, Math.PI * 2); cctx.fill();
      cctx.strokeStyle = pal.fg; cctx.lineWidth = 1; cctx.stroke();
      cctx.beginPath();
      MANHATTAN.forEach(([x, y], i) => { const X = nsx + x * scale, Y = nsy - y * scale; i ? cctx.lineTo(X, Y) : cctx.moveTo(X, Y); });
      cctx.closePath();
      cctx.fillStyle = 'rgba(20,24,32,0.55)'; cctx.fill();
      cctx.strokeStyle = '#ffffff'; cctx.lineWidth = 1.2; cctx.stroke();
      cctx.font = '12px JetBrains Mono, ui-monospace, monospace'; cctx.textAlign = 'left'; cctx.textBaseline = 'top';
      cctx.fillStyle = pal.fg;
      cctx.fillText(`Neutron star: R ≈ ${fmt(Rkm, 3)} km, M ≈ ${fmt(M, 3)} M☉`, 10, 8);
      cctx.fillStyle = pal.muted;
      cctx.fillText('Outline: Manhattan (21.6 km long), same scale', 10, 24);
      // scale bar
      cctx.strokeStyle = pal.muted; cctx.lineWidth = 1.5; cctx.beginPath();
      cctx.moveTo(10, CH - 12); cctx.lineTo(10 + 10 * scale, CH - 12); cctx.stroke();
      cctx.textBaseline = 'bottom'; cctx.fillText('10 km', 10, CH - 15);
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
