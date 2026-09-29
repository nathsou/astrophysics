// Chapter 1: trigonometric parallax. Left: the Earth's orbit seen from above, with the sight line
// to a nearby star (distance hugely compressed). Right: the sky around that star, where it traces
// a parallax ellipse of semi-major axis p = 1/d arcsec against much more distant background stars.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)'}`;
    host.append(wrap);
    const left = createStage(wrap, { aspect: 1 });
    const right = createStage(wrap, { aspect: 1 });
    left.el.style[narrow ? 'borderBottom' : 'borderRight'] = '1px solid var(--rule)';
    const lc = left.canvas.getContext('2d')!, rc = right.canvas.getContext('2d')!;

    let d = 10; // pc
    const beta = (55 * Math.PI) / 180; // ecliptic latitude of the star
    let phase = 0;
    const trail: number[] = [];
    // background "quasars": fixed on the sky
    const bg = Array.from({ length: 60 }, (_, i) => [Math.sin(i * 12.9898) * 43758.5453 % 1, Math.sin(i * 78.233) * 12345.678 % 1, 0.3 + (Math.abs(Math.sin(i * 3.1)) * 0.7)]);

    function drawLeft() {
      const { width: W, height: H, dpr } = left;
      const c = lc;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.72, R = Math.min(W, H) * 0.2;
      c.strokeStyle = pal.faint; c.setLineDash([3, 4]);
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.setLineDash([]);
      const sg = c.createRadialGradient(cx, cy, 0, cx, cy, 12);
      sg.addColorStop(0, '#fff6dd'); sg.addColorStop(0.35, '#f0b35a'); sg.addColorStop(1, 'rgba(240,179,90,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, 12, 0, 7); c.fill();
      // star: drawn at a compressed distance that still grows with d
      const sy = cy - R * (1.6 + 1.1 * Math.log10(1 + d));
      const ex = cx + R * Math.cos(phase), ey = cy - R * Math.sin(phase) * 0.999;
      c.strokeStyle = pal.accent; c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(cx, Math.max(8, sy)); c.stroke();
      c.globalAlpha = 0.35; c.strokeStyle = pal.muted;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, Math.max(8, sy)); c.stroke();
      c.globalAlpha = 1;
      // parallax angle marker at the star
      c.fillStyle = pal.fg;
      c.beginPath(); c.arc(cx, Math.max(8, sy), 4, 0, 7); c.fill();
      c.fillStyle = pal.series[0];
      c.beginPath(); c.arc(ex, ey, 5, 0, 7); c.fill();
      c.font = '11px JetBrains Mono, ui-monospace, monospace';
      c.fillStyle = pal.muted;
      c.fillText('Earth', ex + 8, ey + 4);
      c.fillText('Sun', cx + 12, cy + 16);
      c.fillText(`star, d = ${fmt(d, 3)} pc`, cx + 8, Math.max(8, sy) + 4);
      c.fillStyle = pal.faint;
      c.fillText('1 AU', cx + R / 2 - 10, cy - 4);
      c.fillText(`not to scale: the star is really ${fmt(d * 206265, 3)} AU away`, 10, H - 10);
      c.strokeStyle = pal.faint;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R, cy); c.stroke();
    }

    function drawRight() {
      const { width: W, height: H, dpr } = right;
      const c = rc;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const p = 1 / d; // arcsec
      const field = 3 * p; // half-width of the view in arcsec
      const s = (Math.min(W, H) * 0.45) / field;
      const cx = W / 2, cy = H / 2;
      for (const [u, v, a] of bg) {
        c.fillStyle = pal.faint; c.globalAlpha = a;
        c.beginPath(); c.arc(cx + u * W * 0.5, cy + v * H * 0.5, 1.3, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      // expected ellipse
      c.strokeStyle = pal.grid; c.setLineDash([3, 4]);
      c.beginPath(); c.ellipse(cx, cy, p * s, p * s * Math.sin(beta), 0, 0, 7); c.stroke(); c.setLineDash([]);
      // the star's apparent position: displaced *away* from the Earth's direction
      const x = cx - p * s * Math.cos(phase), y = cy - p * s * Math.sin(beta) * Math.sin(phase) * -1;
      trail.push(x, y);
      if (trail.length > 400) trail.splice(0, 2);
      c.strokeStyle = pal.accent; c.globalAlpha = 0.5;
      c.beginPath();
      for (let i = 0; i < trail.length; i += 2) i ? c.lineTo(trail[i], trail[i + 1]) : c.moveTo(trail[i], trail[i + 1]);
      c.stroke(); c.globalAlpha = 1;
      c.fillStyle = pal.fg;
      c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill();
      // p marker
      c.strokeStyle = pal.series[1];
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + p * s, cy); c.stroke();
      c.fillStyle = pal.series[1];
      c.font = '11px JetBrains Mono, ui-monospace, monospace';
      c.fillText(`p = ${p >= 0.1 ? fmt(p, 3) + '″' : fmt(p * 1000, 3) + ' mas'}`, cx + 4, cy - 6);
      c.fillStyle = pal.muted;
      c.fillText(`sky view, ${fmt(2 * field, 2)}″ across`, 10, 18);
      c.fillStyle = pal.faint;
      c.fillText('faint dots: distant galaxies, which don’t move', 10, H - 10);
    }

    const loop = new Loop((dt) => { phase += dt * 1.2; }, () => { drawLeft(); drawRight(); }, 1 / 60);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    left.onResize(() => loop.invalidate());
    right.onResize(() => { trail.length = 0; loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (v) => (loop.paused = v));
    const rp = panel.readout('Parallax');
    const rg = panel.readout('Gaia DR3 error (bright star, ~0.02 mas)');
    const upd = () => {
      rp.set(`${fmt(1000 / d, 3)} mas`);
      rg.set(`${fmt((0.02 / (1000 / d)) * 100, 2)} % of p`);
    };
    panel.slider('Distance', { min: 1.3, max: 5000, value: d, log: true, unit: 'pc', format: (v) => fmt(v, 3) }, (v) => { d = v; trail.length = 0; upd(); loop.invalidate(); });
    upd();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
