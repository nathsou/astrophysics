// Chapter 17: aberration and relativistic beaming for a source moving at β (Canvas2D).
// Left: rays emitted every 15° in the source's rest frame, redrawn at their lab-frame angles, plus the
// normalised intensity lobe δ^p(θ). Right: the Doppler factor δ(θ) and the boost δ^p vs lab angle.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { aberrate, dopplerObs, fmtBeta } from './relativity/physics';

const EXPONENTS = [
  { value: '2', label: 'δ² (flux of a steady point source)' },
  { value: '2.7', label: 'δ^(2+α) (steady jet, α = 0.7)' },
  { value: '3.7', label: 'δ^(3+α) (single blob, α = 0.7)' },
  { value: '4', label: 'δ⁴ (bolometric intensity)' },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const polar = createStage(wrap, { aspect: 1.15 });
    const right = createStage(wrap, { aspect: 1.15 });
    const ctx = polar.canvas.getContext('2d')!;
    const plot = new Plot(right.canvas, {
      x: { min: 0, max: 180, label: 'lab-frame angle θ from the direction of motion (°)', ticks: [0, 30, 60, 90, 120, 150, 180] },
      y: { min: 1e-3, max: 1e3, log: true, label: 'factor' },
      title: 'Doppler factor δ and boost δᵖ',
    });

    let gamma = 3;
    let p = 3.7;

    function render() {
      const beta = Math.sqrt(1 - 1 / (gamma * gamma));
      const { width: W, height: H, dpr } = polar;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.5, cy = H * 0.52, R = Math.min(W, H) * 0.4;
      ctx.font = '12px Inter, system-ui, sans-serif';
      // reference circle
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      // lobe δ^p(θ), normalised to its maximum (θ = 0)
      const dmax = dopplerObs(0, beta) ** p;
      ctx.beginPath();
      for (let i = 0; i <= 720; i++) {
        const th = (i / 720) * 2 * Math.PI;
        const r = (R * dopplerObs(th, beta) ** p) / dmax;
        const x = cx + r * Math.cos(th), y = cy - r * Math.sin(th);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5; ctx.stroke();
      // rays: every 15° in the rest frame
      for (let k = 0; k < 24; k++) {
        const th0 = (k / 24) * 2 * Math.PI;
        const sgn = th0 > Math.PI ? -1 : 1;
        const th = sgn * aberrate(sgn > 0 ? th0 : 2 * Math.PI - th0, beta);
        const front = Math.cos(th0) > 1e-9;
        ctx.strokeStyle = front ? pal.series[0] : pal.series[2];
        ctx.globalAlpha = 0.85; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * 1.08 * Math.cos(th), cy - R * 1.08 * Math.sin(th)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 1/γ cone
      const c1 = Math.asin(Math.min(1, 1 / gamma));
      ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
      for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * 1.18 * Math.cos(c1), cy - s * R * 1.18 * Math.sin(c1)); ctx.stroke(); }
      ctx.setLineDash([]);
      // source
      ctx.fillStyle = pal.fg; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx + 8, cy + 14); ctx.lineTo(cx + 30, cy + 14); ctx.lineTo(cx + 25, cy + 10); ctx.moveTo(cx + 30, cy + 14); ctx.lineTo(cx + 25, cy + 18); ctx.stroke();
      ctx.fillStyle = pal.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`β = ${fmtBeta(beta)}, γ = ${fmt(gamma, 3)}`, 10, 8);
      ctx.fillStyle = pal.series[0];
      ctx.fillText('rays emitted forward in the rest frame', 10, 26);
      ctx.fillStyle = pal.series[2];
      ctx.fillText('rays emitted backward', 10, 42);
      ctx.fillStyle = pal.muted; ctx.textBaseline = 'bottom';
      ctx.fillText(`half the rays land inside θ = ${fmt((Math.atan2(1 / gamma, beta) * 180) / Math.PI, 3)}°  (dashed: 1/γ)`, 10, H - 8);

      // right-hand plot
      const lo = Math.min(1e-2, dopplerObs(Math.PI, beta) ** p / 3), hi = Math.max(1e2, dmax * 3);
      plot.o.y.min = Math.max(1e-12, 10 ** Math.floor(Math.log10(lo)));
      plot.o.y.max = Math.min(1e14, 10 ** Math.ceil(Math.log10(hi)));
      const thT = (Math.acos(Math.min(1, (1 - 1 / gamma) / beta)) * 180) / Math.PI;
      plot.draw(() => {
        plot.hline(1, { color: pal.faint });
        plot.fn((d) => dopplerObs((d * Math.PI) / 180, beta), { color: pal.series[0], width: 2 });
        plot.fn((d) => dopplerObs((d * Math.PI) / 180, beta) ** p, { color: pal.accent, width: 2 });
        plot.vline(90, { label: `transverse: δ = 1/γ = ${fmt(1 / gamma, 3)}`, color: pal.muted });
        plot.vline(thT, { label: `δ = 1 at ${fmt(thT, 3)}°`, color: pal.series[1] });
        plot.point(90, 1 / gamma, { color: pal.series[0] });
        plot.text('δ', plot.px(4), plot.py(dopplerObs(0.07, beta)) - 4, { color: pal.series[0] });
        plot.text(`δ^${p}`, plot.px(4), plot.py(Math.min(plot.o.y.max, dmax)) + 14, { color: pal.accent });
      });
      readD.set(`${fmt(dopplerObs(0, beta), 4)} / ${fmt(dopplerObs(Math.PI, beta), 3)}`);
      readB.set(`${fmt(dmax / dopplerObs(Math.PI, beta) ** p, 3)}`);
    }

    const loop = new Loop(null, render);

    loop.onDemand = true;
    polar.onResize(() => loop.invalidate());
    right.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('Lorentz factor γ', { min: 1.001, max: 300, value: gamma, log: true, format: (v) => `${fmt(v, 3)} (β = ${fmtBeta(Math.sqrt(1 - 1 / (v * v)))})` }, (v) => { gamma = v; loop.invalidate(); });
    panel.select('Boost', EXPONENTS, '3.7', (v) => { p = +v; loop.invalidate(); });
    const readD = panel.readout('δ ahead / behind');
    const readB = panel.readout('front/back contrast');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
