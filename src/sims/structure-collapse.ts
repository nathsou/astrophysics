// Chapter 28: spherical top-hat collapse in an Einstein–de Sitter background.
// Shell radius R = A(1 − cos θ), t = B(θ − sin θ); units with t_collapse = 1 and R_turnaround = 1.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const A = 0.5, B = 1 / (2 * Math.PI), T_MAX = 1.3, NS = 600;

/** Solve t = B(θ − sin θ) for θ ∈ [0, 2π] by bisection. */
function thetaOf(t: number) {
  let lo = 0, hi = 2 * Math.PI;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (B * (m - Math.sin(m)) < t) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));';
    host.append(wrap);
    const s1 = createStage(wrap, { aspect: 1.2 }), s2 = createStage(wrap, { aspect: 1.2 });
    const pR = new Plot(s1.canvas, { x: { min: 0, max: T_MAX, label: 't / t_collapse' }, y: { min: 0, max: 2.2, label: 'radius / R_turnaround' }, title: 'Shell radius' });
    const pD = new Plot(s2.canvas, { x: { min: 0, max: T_MAX, label: 't / t_collapse' }, y: { min: 0.01, max: 1000, log: true, label: 'overdensity δ' }, title: 'Nonlinear δ vs linear theory' });

    // precompute tracks
    const ts = new Float64Array(NS), R = new Float64Array(NS), Rbg = new Float64Array(NS), dNL = new Float64Array(NS), dL = new Float64Array(NS);
    // (early-time series: R ≈ (A/2)(6t/B)^{2/3} → background R_bg = (A/2)(6t/B)^{2/3})
    const Rb = (t: number) => (A / 2) * Math.pow((6 * t) / B, 2 / 3);
    for (let i = 0; i < NS; i++) {
      const t = ((i + 1) / NS) * T_MAX; ts[i] = t;
      Rbg[i] = Rb(t);
      if (t < 1) {
        const th = thetaOf(t);
        R[i] = A * (1 - Math.cos(th));
        if (th > 1.5 * Math.PI && R[i] < 0.5) R[i] = 0.5; // virialised at half the turnaround radius
        const ph = th - Math.sin(th);
        dL[i] = 0.6 * Math.pow(0.75 * ph, 2 / 3);
      } else {
        R[i] = 0.5;
        dL[i] = 1.686 * Math.pow(t, 2 / 3);
      }
      dNL[i] = Math.pow(Rbg[i] / R[i], 3) - 1;
    }

    let t = 0.02, playing = true;
    const idx = () => Math.min(NS - 1, Math.max(0, Math.round((t / T_MAX) * NS) - 1));
    const loop = new Loop((dt) => {
      if (!playing) return;
      t += dt * 0.22;
      if (t > T_MAX) t = 0.02;
      tCtl.set(t);
    }, render, 1 / 60);

    function render() {
      const i = idx();
      pR.draw(() => {
        pR.line(ts, Rbg, { color: pal.faint, dash: [5, 4], width: 1.5 });
        pR.line(ts, R, { color: pal.accent, width: 2.5 });
        pR.vline(0.5, { color: pal.faint, dash: [2, 3], label: 'turnaround' });
        pR.vline(1, { color: pal.faint, dash: [2, 3], label: 'collapse' });
        pR.hline(0.5, { color: pal.series[2], dash: [2, 3], label: 'R_vir = R_ta / 2' });
        pR.point(ts[i], R[i], { r: 5, color: pal.accent });
        pR.point(ts[i], Rbg[i], { r: 3.5, color: pal.muted });
        pR.text(pR.pw < 400 ? 'dashed: unperturbed sphere' : 'dashed: background sphere (same mass, unperturbed)', pR.px(0.03), pR.py(1.9), { color: pal.muted, size: 11 });
      });
      pD.draw(() => {
        pD.line(ts, dL, { color: pal.series[1], width: 2 });
        pD.line(ts, dNL, { color: pal.accent, width: 2.5 });
        pD.hline(1.686, { color: pal.series[1], dash: [3, 3] });
        pD.hline(177.7, { color: pal.accent, dash: [3, 3] });
        pD.text('δ_c = 1.686', pD.px(0.03), pD.py(1.686) - 4, { color: pal.series[1], size: 11 });
        pD.text('Δ_vir ≈ 178', pD.px(0.03), pD.py(177.7) - 4, { color: pal.accent, size: 11 });
        pD.vline(1, { color: pal.faint, dash: [2, 3] });
        pD.point(ts[i], Math.max(0.011, dNL[i]), { r: 5, color: pal.accent });
        pD.point(ts[i], dL[i], { r: 4, color: pal.series[1] });
        pD.text('linear theory', pD.px(0.08), pD.py(0.05), { color: pal.series[1], size: 11 });
        pD.text('true (nonlinear)', pD.px(0.55), pD.py(20), { color: pal.accent, size: 11 });
      });
      tOut.set(`δ = ${fmt(dNL[i], 3)}, δ_lin = ${fmt(dL[i], 3)}`);
    }
    s1.onResize((w, h, d) => { pR.resize(w, h, d); loop.invalidate(); });
    s2.onResize((w, h, d) => { pD.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => !playing, (p) => { playing = !p; });
    const tCtl = panel.slider('Time', { min: 0.02, max: T_MAX, value: t, step: 0.002 }, (v) => { t = v; playing = false; loop.invalidate(); });
    const tOut = panel.readout('');
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
