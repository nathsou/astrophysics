// Secondary figure: 21 cm tangent-point geometry. For a line of sight at galactic longitude l
// (|l| < 90°, inner Galaxy), the point of closest approach to the centre — the "tangent point" —
// has the smallest radius R_tan = R0 sin l and the largest line-of-sight velocity, because at that
// point the whole circular-velocity vector points along the line of sight.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);';
    host.append(wrap);
    const geoStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1.2 });
    geoStage.el.style.borderRight = '1px solid var(--rule)';
    const gctx = geoStage.canvas.getContext('2d')!;

    let lDeg = 40;
    const R0 = 8.2, V0 = 230, VC_OUTER = 230; // flat rotation curve, km/s / kpc
    const vc = (r: number) => VC_OUTER * (1 - Math.exp(-r / 1.5)); // rises from 0 near centre, flat outside

    const plot = new Plot(plotStage.canvas, {
      x: { min: 0, max: 20, label: 's, distance along line of sight (kpc)' },
      y: { min: -20, max: 260, label: 'v_LOS (km/s)' },
      title: 'Line-of-sight velocity profile',
    });

    function rOfS(s: number, lRad: number) {
      return Math.sqrt(R0 * R0 + s * s - 2 * R0 * s * Math.cos(lRad));
    }
    function vlos(s: number, lRad: number) {
      const r = rOfS(s, lRad);
      if (r < 1e-6) return 0;
      // Circular-rotation velocity field projected on the line of sight (standard HI kinematics formula).
      return vc(r) * (R0 * Math.sin(lRad)) / r - V0 * Math.sin(lRad);
    }

    const loop = new Loop(null, render, 1 / 30);

    function render() {
      const lRad = (lDeg * Math.PI) / 180;
      const Rtan = R0 * Math.sin(lRad);
      const sTan = R0 * Math.cos(lRad);

      // --- geometry panel (face-on Galaxy) ---
      const { width: W, height: H, dpr } = geoStage;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.clearRect(0, 0, W, H);
      const scale = (Math.min(W, H) / 2 / (R0 * 1.35));
      const cx = W / 2, cy = H / 2;
      // Sun's orbit
      gctx.strokeStyle = pal.faint;
      gctx.beginPath(); gctx.arc(cx, cy, R0 * scale, 0, 2 * Math.PI); gctx.stroke();
      // tangent-point circle
      gctx.strokeStyle = pal.series[1]; gctx.setLineDash([3, 3]);
      gctx.beginPath(); gctx.arc(cx, cy, Rtan * scale, 0, 2 * Math.PI); gctx.stroke();
      gctx.setLineDash([]);
      // GC
      gctx.fillStyle = pal.accent2;
      gctx.beginPath(); gctx.arc(cx, cy, 5, 0, 2 * Math.PI); gctx.fill();
      // Sun position (l measured from the GC-Sun direction, Sun at angle 0)
      const sunX = cx + R0 * scale, sunY = cy;
      gctx.fillStyle = pal.fg;
      gctx.beginPath(); gctx.arc(sunX, sunY, 5, 0, 2 * Math.PI); gctx.fill();
      gctx.fillStyle = pal.muted; gctx.font = '11px Inter, system-ui, sans-serif';
      gctx.fillText('Sun', sunX + 8, sunY + 4);
      gctx.fillText('GC', cx + 8, cy - 8);
      // line of sight: direction from Sun at angle (180 - l) measured so l=0 points at GC
      const dirAngle = Math.PI - lRad;
      const dx = Math.cos(dirAngle), dy = Math.sin(dirAngle);
      const Lmax = 24;
      gctx.strokeStyle = pal.accent; gctx.lineWidth = 1.8;
      gctx.beginPath(); gctx.moveTo(sunX, sunY); gctx.lineTo(sunX + dx * Lmax * scale, sunY + dy * Lmax * scale); gctx.stroke();
      // tangent point marker
      const tx = sunX + dx * sTan * scale, ty = sunY + dy * sTan * scale;
      gctx.fillStyle = pal.series[1];
      gctx.beginPath(); gctx.arc(tx, ty, 4.5, 0, 2 * Math.PI); gctx.fill();
      gctx.fillText('tangent point', tx + 8, ty - 6);
      // radius line GC to tangent point (perpendicular to LOS)
      gctx.strokeStyle = pal.muted; gctx.setLineDash([2, 3]); gctx.lineWidth = 1;
      gctx.beginPath(); gctx.moveTo(cx, cy); gctx.lineTo(tx, ty); gctx.stroke(); gctx.setLineDash([]);
      // angle arc at Sun
      gctx.strokeStyle = pal.muted;
      gctx.beginPath(); gctx.arc(sunX, sunY, 22, Math.PI, dirAngle, true); gctx.stroke();
      gctx.fillText(`l = ${lDeg.toFixed(0)}°`, sunX - 46, sunY - 14);

      // --- velocity profile panel ---
      plot.resize(plotStage.width, plotStage.height, plotStage.dpr);
      plot.o.x.max = Math.max(20, R0 * 2.2);
      plot.draw(() => {
        plot.fn((s) => vlos(s, lRad), { color: pal.accent, width: 2 });
        plot.hline(0, { color: pal.faint, width: 1 });
        const vTerm = vlos(sTan, lRad);
        plot.vline(sTan, { color: pal.series[1], label: 'tangent point' });
        plot.point(sTan, vTerm, { r: 4, color: pal.series[1], label: `v_term ≈ ${fmt(vTerm, 3)} km/s` });
      });

      readout.set(`R_tan = ${fmt(Rtan, 3)} kpc,  v_term = ${fmt(vlos(sTan, lRad), 3)} km/s  ⇒  v_c(R_tan) = ${fmt(vlos(sTan, lRad) + V0 * Math.sin(lRad), 3)} km/s`);
    }

    geoStage.onResize(() => loop.invalidate());
    plotStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Galactic longitude l', { min: 5, max: 85, value: lDeg, unit: '°' }, (v) => { lDeg = v; loop.invalidate(); });
    const readout = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
