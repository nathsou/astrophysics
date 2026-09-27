// The lens equation in one dimension: beta = theta - alpha(theta). Images are where the horizontal line
// beta = beta_s crosses the curve. Angles in units of the Einstein radius θ_E.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

type M = 'point' | 'sis';
const alpha = (m: M, t: number) => (m === 'point' ? 1 / t : Math.sign(t));
const dalpha = (m: M, t: number) => (m === 'point' ? -1 / (t * t) : 0);

function images(m: M, b: number): number[] {
  if (m === 'point') { const r = Math.sqrt(b * b + 4); return [(b + r) / 2, (b - r) / 2]; }
  const sg = b >= 0 ? 1 : -1;
  return Math.abs(b) < 1 ? [b + sg, b - sg] : [b + sg];
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 1.35 });
    stage.el.style.touchAction = 'none';
    const plot = new Plot(stage.canvas, { x: { min: -3, max: 3, label: 'image position θ / θ_E' }, y: { min: -3, max: 3.4, label: 'source position β / θ_E' }, margin: { l: 50, r: 16, t: 16, b: 84 } });
    let model: M = 'point', beta = 0.5;

    function render() {
      const imgs = images(model, beta);
      plot.draw(() => {
        plot.fn((t) => t, { color: pal.faint, dash: [4, 4], width: 1 });
        const f = (t: number) => t - alpha(model, t);
        plot.fn((t) => (t > 0 ? f(t) : NaN), { color: pal.series[0], samples: 400 });
        plot.fn((t) => (t < 0 ? f(t) : NaN), { color: pal.series[0], samples: 400 });
        plot.hline(0, { color: pal.axis, dash: [] });
        plot.vline(0, { color: pal.axis, dash: [] });
        plot.hline(beta, { color: pal.accent, dash: [], width: 1.5 });
        plot.vline(1, { color: pal.faint, label: '+θ_E' });
        plot.vline(-1, { color: pal.faint, label: '−θ_E' });
        for (const t of imgs) plot.point(t, beta, { r: 5, color: pal.accent2, stroke: pal.fg });
      });
      plot.text('β = θ − α(θ)', plot.px(2.1), plot.py(1.95), { color: pal.series[0] });
      plot.text('β = θ (no lens)', plot.px(1.2), plot.py(2.6), { color: pal.muted });
      plot.text('drag the source line ↕', plot.m.l + 6, plot.m.t + 12, { color: pal.accent });
      // sky strip
      const ctx = plot.ctx, y0 = stage.height - 26;
      ctx.strokeStyle = pal.grid; ctx.beginPath(); ctx.moveTo(plot.m.l, y0); ctx.lineTo(plot.m.l + plot.pw, y0); ctx.stroke();
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(plot.px(0), y0, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = pal.accent; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(plot.px(beta), y0, 6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const txt: string[] = [];
      let tot = 0;
      for (const t of imgs) {
        const mu = 1 / ((beta / t) * (1 - dalpha(model, t)));
        tot += Math.abs(mu);
        const r = 3 + 3 * Math.sqrt(Math.min(Math.abs(mu), 30));
        ctx.fillStyle = mu > 0 ? pal.accent2 : pal.series[3];
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(plot.px(t), y0, 2.5, r, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        txt.push(`θ=${fmt(t, 3)} μ=${fmt(mu, 3)}`);
      }
      plot.text('sky: lens ●, true source ◌, images (height ∝ √|μ|)', plot.m.l, y0 - 16, { color: pal.muted, size: 10 });
      ro.set(txt.join(' · ') + ` · total |μ| = ${fmt(tot, 3)}`);
    }
    const loop = new Loop(null, render);
    loop.onDemand = true; // static figure: redraw only on invalidate()
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    let drag = false;
    const setB = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      beta = Math.max(-2.8, Math.min(2.8, plot.dy(e.clientY - r.top)));
      if (Math.abs(beta) < 0.01) beta = beta < 0 ? -0.01 : 0.01;
      loop.invalidate();
    };
    stage.el.addEventListener('pointerdown', (e) => { drag = true; stage.el.setPointerCapture(e.pointerId); setB(e); });
    stage.el.addEventListener('pointermove', (e) => { if (drag) setB(e); });
    stage.el.addEventListener('pointerup', () => (drag = false));

    const panel = new Panel(host);
    panel.select<M>('Lens', [{ value: 'point', label: 'Point mass' }, { value: 'sis', label: 'Singular isothermal sphere' }], model, (v) => { model = v; loop.invalidate(); });
    const ro = panel.readout('Images:');
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
