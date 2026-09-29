// Secondary figure: the lag angle of Earth's tidal bulge (dragged ahead by friction/rotation)
// and the torque it exerts back on the Moon, which is why the Moon recedes and the day lengthens.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

// Calibration: today's lag (about 3°, from lunar laser ranging) gives today's 3.8 cm/yr recession
// and ~2.3 ms/century of tidal day lengthening; the torque, and so both rates, scale as sin(2δ).
const LAG_NOW = 3;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const s = { lagDeg: LAG_NOW };

    function arrow(x0: number, y0: number, x1: number, y1: number, color: string, width = 2) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      if (L < 2) return;
      const ux = dx / L, uy = dy / L;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * 6, y1 - uy * 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * 8 - uy * 4.5, y1 - uy * 8 + ux * 4.5); ctx.lineTo(x1 - ux * 8 + uy * 4.5, y1 - uy * 8 - ux * 4.5); ctx.closePath(); ctx.fill();
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.3, cy = H / 2;
      const R = Math.min(W, H) * 0.2;
      const lag = (s.lagDeg * Math.PI) / 180;
      const font = '11px JetBrains Mono, ui-monospace, monospace';

      // Ocean bulge, dragged ahead of the Earth–Moon line (+x) by the lag angle, in the direction
      // of Earth's spin (clockwise on screen, like the Moon's orbit).
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(lag);
      ctx.scale(1.3, 0.92);
      ctx.fillStyle = 'rgba(110,170,240,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // solid Earth
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R * 0.9);
      g.addColorStop(0, '#5d93d6'); g.addColorStop(1, '#27497d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2); ctx.fill();

      // spin arrow
      ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, -2.2, -1.1); ctx.stroke();
      const ea = -1.1;
      arrow(cx + R * 1.6 * Math.cos(ea - 0.05), cy + R * 1.6 * Math.sin(ea - 0.05), cx + R * 1.6 * Math.cos(ea + 0.02), cy + R * 1.6 * Math.sin(ea + 0.02), pal.muted, 1.5);
      ctx.fillStyle = pal.muted; ctx.font = font; ctx.textAlign = 'center';
      ctx.fillText('Earth spins (once a day)', cx, cy - R * 1.72);

      // Earth–Moon line and the bulge axis
      const mx = cx + R * 3.9, my = cy;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = pal.faint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my); ctx.stroke();
      ctx.strokeStyle = pal.accent;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(lag) * R * 1.5, cy - Math.sin(lag) * R * 1.5); ctx.lineTo(cx + Math.cos(lag) * R * 1.9, cy + Math.sin(lag) * R * 1.9); ctx.stroke();
      ctx.setLineDash([]);
      if (s.lagDeg > 0.05) {
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.75, 0, lag); ctx.stroke();
        ctx.fillStyle = pal.accent; ctx.textAlign = 'left';
        ctx.fillText(`lag δ = ${fmt(s.lagDeg, 2)}°`, cx + R * 1.95, cy + Math.max(14, Math.sin(lag) * R * 1.9 + 4));
      }

      // Moon, with the near bulge's pull split into a radial part and a small forward part
      ctx.fillStyle = '#c9c6bf';
      ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg; ctx.textAlign = 'center'; ctx.font = font;
      ctx.fillText('Moon', mx, my - 20);
      const bx = cx + Math.cos(lag) * R * 1.3, by = cy + Math.sin(lag) * R * 1.3;
      const fx = bx - mx, fy = by - my, fl = Math.hypot(fx, fy);
      const len = 46;
      arrow(mx, my, mx + (fx / fl) * len, my + (fy / fl) * len, pal.series[3]);
      const tang = (fy / fl) * len * 10; // forward (orbit-direction) component, magnified 10×
      if (Math.abs(tang) > 3) {
        arrow(mx + 16, my, mx + 16, my + tang, pal.good);
        ctx.fillStyle = pal.good; ctx.textAlign = 'right';
        ctx.fillText('forward tug (×10): speeds the Moon up', mx + 8, my + tang + 16);
      }
      ctx.fillStyle = pal.series[3]; ctx.textAlign = 'right';
      ctx.fillText('pull of the near bulge', mx - 16, my - 8);

      const scale = Math.sin(2 * lag) / Math.sin((2 * LAG_NOW * Math.PI) / 180);
      const rate = 3.8 * scale;
      readout1.set(`${fmt(rate, 3)} cm/yr (${fmt((rate * 1e8) / 1e5, 3)} km per 100 Myr)`);
      readout2.set(`${fmt(2.3 * scale, 3)} ms per century`);
    }

    const loop = new Loop(null, render, 1 / 30);

    loop.onDemand = true; // static figure: redraw only on invalidate()
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Bulge lag angle δ', { min: 0, max: 15, value: s.lagDeg, step: 0.1, unit: '°' }, (v) => { s.lagDeg = v; loop.invalidate(); });
    const readout1 = panel.readout('Moon recedes at');
    const readout2 = panel.readout('Day lengthens by');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
