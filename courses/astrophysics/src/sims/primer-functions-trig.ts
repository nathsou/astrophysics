// Appendix A2: the unit circle and the small-angle approximation.
// Left: drag the point around the circle; cos θ and sin θ are its x and y, tan θ is the height where
// the ray meets the tangent line x = 1, and the arc length is θ in radians. Right: sin θ, θ and tan θ
// against θ, with the relative error of sin θ ≈ tan θ ≈ θ (≈ θ²/6 and θ²/3 for small θ).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { stackWhenNarrow } from './primer-common/stack';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

const PRESETS: { label: string; rad: number }[] = [
  { label: '60°', rad: 60 * DEG },
  { label: '30°', rad: 30 * DEG },
  { label: '10°', rad: 10 * DEG },
  { label: 'Full Moon (0.52°)', rad: 0.52 * DEG },
  { label: 'Proxima parallax (0.768″)', rad: 0.768 * ARCSEC },
  { label: 'M87* ring (42 μas)', rad: 42e-6 * ARCSEC },
];

/** Relative errors of θ vs sin θ and θ vs tan θ, accurate even when θ is tiny. */
function relErr(t: number): [number, number] {
  if (t < 1e-3) return [t * t / 6 + (7 * t ** 4) / 360, t * t / 3 + (t ** 4) / 45];
  return [t / Math.sin(t) - 1, 1 - t / Math.tan(t)];
}

function angleStr(t: number): string {
  const d = t / DEG;
  if (d >= 1) return `${fmt(d, 3)}°`;
  const as = t / ARCSEC;
  if (as >= 60) return `${fmt(d * 60, 3)}′ (${fmt(d, 3)}°)`;
  if (as >= 1e-2) return `${fmt(as, 3)}″`;
  return `${fmt(as * 1e6, 3)} μas`;
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    let th = 35 * DEG;
    let dragging = false;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);';
    host.append(wrap);
    const cs = createStage(wrap, { aspect: 1 });
    const ps = createStage(wrap, { aspect: 1 / 0.8 });
    stackWhenNarrow(host, wrap, 'minmax(0,1fr) minmax(0,1.25fr)', [[cs, 1, 1.25], [ps, 1.25, 1.35]], onDestroy);
    cs.el.style.borderRight = '1px solid var(--rule)';
    const ctx = cs.canvas.getContext('2d')!;
    const plot = new Plot(ps.canvas, {
      x: { min: 0, max: 90, label: 'angle θ (degrees)', ticks: [0, 15, 30, 45, 60, 75, 90] },
      y: { min: 0, max: 2, label: 'value' },
      margin: { l: 40, r: 12, t: 14, b: 42 },
    });

    const loop = new Loop(null, render);

    loop.onDemand = true;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    cs.onResize(() => loop.invalidate());
    ps.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const geom = () => {
      const { width: W, height: H } = cs;
      const R = Math.min(W, H) * 0.34;
      return { cx: W * 0.36, cy: H * 0.6, R };
    };

    function render() {
      const { width: W, height: H, dpr } = cs;
      const { cx, cy, R } = geom();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = '12px Inter, system-ui, sans-serif';
      // axes and circle
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - R * 1.15, cy); ctx.lineTo(W - 4, cy); ctx.moveTo(cx, cy + R * 1.15); ctx.lineTo(cx, 4); ctx.stroke();
      ctx.strokeStyle = pal.axis;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      const c = Math.cos(th), s = Math.sin(th), t = Math.tan(th);
      const px = cx + R * c, py = cy - R * s;
      // tangent line x = 1 and tan segment
      ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(cx + R, cy + R * 0.3); ctx.lineTo(cx + R, 4); ctx.stroke();
      ctx.setLineDash([]);
      const ty = Math.max(-1e4, cy - R * t); // canvas clips anything off-screen
      ctx.strokeStyle = pal.faint;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, ty); ctx.stroke();
      ctx.strokeStyle = pal.series[2]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + R, cy); ctx.lineTo(cx + R, ty); ctx.stroke();
      // arc = θ (radians)
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, -th, true); ctx.stroke();
      // radius, cos and sin
      ctx.lineWidth = 1.5; ctx.strokeStyle = pal.fg;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = pal.series[1];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();
      ctx.strokeStyle = pal.series[3];
      ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(px, py, dragging ? 8 : 6.5, 0, Math.PI * 2); ctx.fill();
      // labels (haloed so they stay legible where they cross a line)
      const label = (text: string, x: number, y: number, color: string, align: CanvasTextAlign) => {
        ctx.textAlign = align;
        ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = pal.bg;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color; ctx.fillText(text, x, y);
      };
      ctx.textBaseline = 'middle';
      label('cos θ', (cx + px) / 2, cy + 12, pal.series[1], 'center');
      label('sin θ', px - 7, (cy + py) / 2, pal.series[3], 'right');
      // arc label just outside the circle at the arc's midpoint; the tan label sits at the top of its
      // segment, pushed up if it would collide with the arc label.
      const ax = cx + R * 1.1 * Math.cos(th / 2), ay = cy - R * 1.1 * Math.sin(th / 2);
      label('arc θ', ax + 4, ay, pal.accent, 'left');
      const tanY = Math.max(14, Math.min(ty + 8, ay - 18));
      label('tan θ', cx + R + 8, tanY, pal.series[2], 'left');
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('radius = 1 · drag the dot', 8, H - 8);

      const deg = th / DEG;
      plot.draw(() => {
        plot.fn((d) => d * DEG, { color: pal.accent, width: 2 });
        plot.fn((d) => Math.sin(d * DEG), { color: pal.series[3], width: 2 });
        plot.fn((d) => Math.tan(d * DEG), { color: pal.series[2], width: 2 });
        plot.vline(deg, { color: pal.fg, alpha: 0.5 });
        plot.point(deg, th, { color: pal.accent });
        plot.point(deg, Math.sin(th), { color: pal.series[3] });
        if (Math.tan(th) < 2) plot.point(deg, Math.tan(th), { color: pal.series[2] });
      });
      plot.text('tan θ', plot.px(62), plot.py(1.9), { color: pal.series[2] });
      plot.text('θ (radians)', plot.px(72), plot.py(1.3), { color: pal.accent });
      plot.text('sin θ', plot.px(75), plot.py(0.9), { color: pal.series[3] });

      const [es, et] = relErr(th);
      rAng.set(`${angleStr(th)} = ${fmt(th, 4)} rad`);
      rSin.set(`${fmt(es * 100, 3)}%`);
      rTan.set(`${fmt(et * 100, 3)}%`);
    }

    const toAngle = (e: PointerEvent) => {
      const r = cs.canvas.getBoundingClientRect();
      const { cx, cy } = geom();
      const a = Math.atan2(cy - (e.clientY - r.top), e.clientX - r.left - cx);
      th = Math.min(89.5 * DEG, Math.max(1e-3 * DEG, a));
      sl.set(th / DEG);
      loop.invalidate();
    };
    cs.canvas.style.touchAction = 'none';
    cs.canvas.addEventListener('pointerdown', (e) => { dragging = true; cs.canvas.setPointerCapture(e.pointerId); toAngle(e); });
    cs.canvas.addEventListener('pointermove', (e) => { if (dragging) toAngle(e); });
    cs.canvas.addEventListener('pointerup', () => { dragging = false; loop.invalidate(); });

    const panel = new Panel(host);
    const sl = panel.slider('θ', { min: 0.01, max: 89.5, value: th / DEG, step: 0.01, format: (v) => `${fmt(v, 3)}°` }, (v) => { th = v * DEG; loop.invalidate(); });
    panel.select('Preset', [{ value: '', label: 'choose…' }, ...PRESETS.map((p, i) => ({ value: String(i), label: p.label }))], '', (v) => {
      if (v === '') return;
      th = PRESETS[+v].rad; sl.set(Math.max(0.01, th / DEG)); loop.invalidate();
    });
    const rAng = panel.readout('θ =');
    const rSin = panel.readout('error of sin θ ≈ θ:');
    const rTan = panel.readout('error of tan θ ≈ θ:');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
