// Secondary figure: the lag angle of Earth's tidal bulge (dragged ahead by friction/rotation)
// and the torque it exerts back on the Moon, which is why the Moon recedes and the day lengthens.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const s = { lagDeg: 3, spinRate: 2.2, orbitPhase: 0 };

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.38, cy = H / 2;
      const R = Math.min(W, H) * 0.24;
      const lag = (s.lagDeg * Math.PI) / 180;

      // Earth spins faster than the Moon orbits, so friction drags the bulge axis ahead
      // (in the spin direction) of the Earth–Moon line by the lag angle.
      const bulgeAng = lag; // relative to the Earth–Moon line, which we draw along +x
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(bulgeAng);
      ctx.scale(1.22, 0.86);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, pal.series[0]); g.addColorStop(1, pal.accent);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Spin arrow.
      ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, -0.7, 0.1); ctx.stroke();
      ctx.save(); ctx.translate(cx + R * 1.55 * Math.cos(0.1), cy + R * 1.55 * Math.sin(0.1)); ctx.rotate(0.1 + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -8); ctx.lineTo(5, -8); ctx.closePath(); ctx.fillStyle = pal.muted; ctx.fill(); ctx.restore();
      ctx.fillStyle = pal.muted; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('spin (23.9 h)', cx, cy - R * 1.75);

      // Earth–Moon line.
      const mx = cx + R * 3.6, my = cy;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = pal.faint;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.series[2];
      ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg; ctx.textAlign = 'center'; ctx.fillText('Moon', mx, my - 20);

      // Force from the near bulge on the Moon, resolved into a small forward (tangential)
      // component: this is the torque that speeds the Moon up and drags Earth's spin down.
      const bulgeX = cx + R * 1.22 * Math.cos(bulgeAng), bulgeY = cy + R * 1.22 * Math.sin(bulgeAng);
      ctx.strokeStyle = pal.series[3]; ctx.lineWidth = 2;
      const fx = mx - bulgeX, fy = my - bulgeY, fl = Math.hypot(fx, fy);
      const ex = fx / fl, ey = fy / fl;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + ex * 26, my + ey * 26); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx + ex * 26, my + ey * 26, 3, 0, Math.PI * 2); ctx.fillStyle = pal.series[3]; ctx.fill();

      // Distance / day-length readouts.
      const dNow = 384_400; // km, present Earth–Moon distance
      const recession = 3.8; // cm/yr
      const yearsBack = 400e6;
      const dPast = dNow - (recession * yearsBack) / 1e5; // cm→km over 400 Myr, roughly (extrapolated)
      readout1.set(`Recession rate ≈ ${fmt(recession, 2)} cm/yr  →  ${fmt((recession * 1e8) / 1e5, 3)} km per 100 Myr`);
      readout2.set(`Day length grows ≈ 2 ms/century; 400 Myr ago (Devonian) a year held ≈ 400 days`);
      readout3.set(`Lag angle ${fmt(s.lagDeg, 2)}° (real Earth–Moon system: ≈ 0.15°, small but nonzero)`);
    }

    const loop = new Loop((h) => { s.orbitPhase += h * 0.3; }, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Bulge lag angle', { min: 0, max: 15, value: s.lagDeg, step: 0.1, unit: '°' }, (v) => { s.lagDeg = v; loop.invalidate(); });
    const readout1 = panel.readout('');
    const readout2 = panel.readout('');
    const readout3 = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
