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

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1.2 : 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;

    const T = 5772;
    // d in AU
    let d = 1;
    const pxPerRsunAtOneAU = 0.03; // angular size scaling constant chosen for a legible display

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // a night sky in both themes: the star is drawn in its physical colour
      ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
      const sky = { rule: 'rgba(200,210,235,0.35)', muted: 'rgba(220,226,240,0.75)' };

      const cx = W * 0.32, cy = H / 2;
      const angRadiusPx = Math.max(0.5, (Math.min(W, H) * pxPerRsunAtOneAU) / d);

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
      const detW = Math.min(W * 0.45, H * 0.7, 220), detH = detW, detX = W * 0.68;
      const gridN = 15;
      const cell = detW / gridN;
      ctx.strokeStyle = sky.rule;
      ctx.strokeRect(detX - detW / 2, cy - detH / 2, detW, detH);
      const surfaceI = sigmaSB * T ** 4 / Math.PI; // specific intensity of the disk, W/m²/sr — constant!
      // The detector sees the sky magnified ×4. Each pixel records the mean intensity over its area:
      // the fraction of it the disk covers (5×5 supersampling, or the exact area ratio once the disk
      // is smaller than a pixel) times the constant surface brightness.
      const Rdet = ((Math.min(W, H) * pxPerRsunAtOneAU) / d) * 4;
      let peak = 0;
      for (let iy = 0; iy < gridN; iy++) {
        for (let ix = 0; ix < gridN; ix++) {
          const x0 = ix * cell - detW / 2, y0 = iy * cell - detH / 2;
          let f = 0;
          if (Rdet < cell * 0.5) f = ix === (gridN >> 1) && iy === (gridN >> 1) ? (Math.PI * Rdet * Rdet) / (cell * cell) : 0;
          else {
            for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) if (Math.hypot(x0 + (sx + 0.5) * cell / 5, y0 + (sy + 0.5) * cell / 5) < Rdet) f += 1 / 25;
          }
          peak = Math.max(peak, f);
          if (f > 0) {
            ctx.fillStyle = `rgba(${rgb},${f.toFixed(4)})`;
            ctx.fillRect(detX - detW / 2 + ix * cell, cy - detH / 2 + iy * cell, cell, cell);
          }
        }
      }
      ctx.strokeStyle = sky.rule; ctx.globalAlpha = 0.5;
      for (let k = 1; k < gridN; k++) {
        ctx.beginPath(); ctx.moveTo(detX - detW / 2 + k * cell, cy - detH / 2); ctx.lineTo(detX - detW / 2 + k * cell, cy + detH / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(detX - detW / 2, cy - detH / 2 + k * cell); ctx.lineTo(detX + detW / 2, cy - detH / 2 + k * cell); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = sky.muted;
      ctx.textAlign = 'center';
      ctx.fillText(`brightest pixel: ${fmt(peak * 100, 3)}% of the surface brightness`, detX, cy + detH / 2 + 18);
      const resolvedDet = Rdet >= cell * 0.5;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = sky.muted;
      ctx.textAlign = 'center';
      ctx.fillText(resolvedDet ? 'detector (×4 zoom): resolved disk' : 'detector (×4 zoom): unresolved point source', detX, cy - detH / 2 - 8);

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
