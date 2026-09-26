// Chapter 4, figure: inverse-square law vs. surface-brightness conservation. Move a star further
// away: the total flux you collect falls as 1/d², but as long as the disk is still resolved, the
// brightness of *each pixel on the disk* does not change — only the disk shrinks.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { Rsun, Lsun, sigmaSB } from '../lib/physics/constants';
import { blackbodyRGB } from '../lib/physics/blackbody';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;

    const T = 5772;
    // d in AU
    let d = 1;
    const pxPerRsunAtOneAU = 0.03; // angular size scaling constant chosen for a legible display

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.32, cy = H / 2;
      const angRadiusPx = Math.max(0.5, (Math.min(W, H) * pxPerRsunAtOneAU) / d);
      const resolved = angRadiusPx > 1.5;

      const [r, g, b] = blackbodyRGB(T);
      const rgb = `${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0}`;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, angRadiusPx * 3);
      glow.addColorStop(0, `rgba(${rgb},0.5)`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, angRadiusPx * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.beginPath(); ctx.arc(cx, cy, angRadiusPx, 0, Math.PI * 2); ctx.fill();

      // "detector" with a small grid of pixels sampling the disk, to the right
      const detX = W * 0.68, detW = Math.min(W * 0.5, 220), detH = detW;
      const gridN = 9;
      const cell = detW / gridN;
      ctx.strokeStyle = pal.rule;
      ctx.strokeRect(detX - detW / 2, cy - detH / 2, detW, detH);
      const surfaceI = sigmaSB * T ** 4 / Math.PI; // specific intensity of the disk, W/m²/sr — constant!
      // Zoom the detector view so the disk (or its unresolved core) stays visible regardless of d.
      const diskPxRadiusOnDetector = Math.max(3, Math.min(detW / 2 - 2, angRadiusPx * 4));
      for (let iy = 0; iy < gridN; iy++) {
        for (let ix = 0; ix < gridN; ix++) {
          const px = detX - detW / 2 + (ix + 0.5) * cell;
          const py = cy - detH / 2 + (iy + 0.5) * cell;
          const onDisk = Math.hypot(px - detX, py - cy) < Math.max(diskPxRadiusOnDetector, resolved ? 4 : 3);
          if (onDisk) {
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.fillRect(detX - detW / 2 + ix * cell, cy - detH / 2 + iy * cell, cell, cell);
          }
        }
      }

      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'center';
      ctx.fillText(resolved ? 'resolved disk' : 'unresolved (point source)', detX, cy - detH / 2 - 8);

      const flux = Lsun / (4 * Math.PI * (d * 1.495978707e11) ** 2);
      readout1.set(`${fmt(flux, 3)} W/m² (∝ 1/d²)`);
      readout2.set(`${fmt(surfaceI, 3)} W m⁻² sr⁻¹ (constant!)`);
      readout3.set(`d = ${fmt(d, 3)} AU`);
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Distance', { min: 0.2, max: 2000, value: d, log: true, unit: 'AU' }, (v) => { d = v; loop.invalidate(); });
    const readout3 = panel.readout('Distance:');
    const readout1 = panel.readout('Flux received:');
    const readout2 = panel.readout('Surface brightness of disk:');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
