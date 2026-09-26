// Secondary figure: the tidal acceleration field around a body, and the two bulges it raises.
// Drag the perturber (or its slider) closer and the arrows grow as 1/d³, not 1/d².

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host, params, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const s = { d: +(params.distance ?? 3), M: 1, bodyR: 1 };
    let dragging = false;

    function tidal(x: number, y: number, d: number, M: number): [number, number] {
      // Linearised (leading-order) differential acceleration relative to the body's centre,
      // in units where the local acceleration g0 = GM_body / bodyR^2 is 1.
      const k = 2 * M / (d * d * d); // coefficient of the along-axis term (GM factored into k via bodyR-normalised units)
      return [k * x, -0.5 * k * y];
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) / 5;
      const cx = W / 2, cy = H / 2;

      // Arrow field of the tidal acceleration (data units: body radii).
      const N = 9;
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j <= N; j++) {
          const x = i * 0.42, y = j * 0.42;
          if (Math.hypot(x, y) < 1.15) continue;
          const [ax, ay] = tidal(x, y, s.d, s.M);
          const mag = Math.hypot(ax, ay);
          const len = Math.min(0.9, 0.16 + 0.55 * Math.sqrt(mag));
          const ux = ax / (mag || 1), uy = ay / (mag || 1);
          const X0 = cx + x * scale, Y0 = cy - y * scale;
          const X1 = cx + (x + ux * len) * scale, Y1 = cy - (y + uy * len) * scale;
          ctx.strokeStyle = pal.series[0];
          ctx.globalAlpha = 0.35 + 0.55 * Math.min(1, mag * 2);
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
          const ang = Math.atan2(Y1 - Y0, X1 - X0);
          ctx.beginPath();
          ctx.moveTo(X1, Y1);
          ctx.lineTo(X1 - 5 * Math.cos(ang - 0.4), Y1 - 5 * Math.sin(ang - 0.4));
          ctx.lineTo(X1 - 5 * Math.cos(ang + 0.4), Y1 - 5 * Math.sin(ang + 0.4));
          ctx.closePath(); ctx.fillStyle = pal.series[0]; ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // The body, distorted into the tidal bulge (exaggerated for visibility).
      const bulge = Math.min(0.35, 0.12 * (2 / (s.d * s.d * s.d)) * 6);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1 + bulge, 1 - bulge * 0.5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, scale);
      g.addColorStop(0, pal.accent2); g.addColorStop(1, pal.accent);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, scale, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = pal.muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('bulges point toward and away from the perturber', cx, cy - scale - 14);

      // The perturber.
      const px = cx + s.d * scale, py = cy;
      ctx.fillStyle = pal.series[3];
      ctx.beginPath(); ctx.arc(px, py, 8 + 2 * Math.sqrt(s.M), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('perturber', px, py - 16);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = pal.faint;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);

      readout.set(`d = ${fmt(s.d, 3)} R,  a_tidal ∝ 1/d³ = ${fmt(2 / (s.d ** 3), 3)} (axis), ${fmt(-1 / (s.d ** 3), 3)} (transverse), in units of g₀`);
    }

    const loop = new Loop(null, render, 1 / 60);
    stage.onResize(() => loop.invalidate());

    const drag = (clientX: number, clientY: number) => {
      const r = stage.el.getBoundingClientRect();
      const scale = Math.min(stage.width, stage.height) / 5;
      const x = (clientX - r.left - stage.width / 2) / scale;
      s.d = Math.max(1.3, Math.min(8, x));
      dSlider.set(s.d);
      loop.invalidate();
    };
    stage.canvas.style.touchAction = 'none';
    const onMove = (e: PointerEvent) => { if (dragging) drag(e.clientX, e.clientY); };
    const onUp = () => (dragging = false);
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; drag(e.clientX, e.clientY); });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    onDestroy(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });

    const panel = new Panel(host);
    const readout = panel.readout('');
    const dSlider = panel.slider('Perturber distance', { min: 1.3, max: 8, value: s.d, step: 0.05, unit: 'R' }, (v) => { s.d = v; loop.invalidate(); });
    panel.slider('Perturber mass', { min: 0.2, max: 20, value: s.M, step: 0.1, log: true }, (v) => { s.M = v; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
