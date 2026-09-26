// Secondary figure: a schematic Milky Way, edge-on and face-on, showing the thin/thick disk,
// bulge/bar, stellar halo, a few globular clusters, and the Sun's position at R0 ≈ 8.2 kpc.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let view: 'edge' | 'face' = 'face';

    const NGLOB = 22;
    const globR = new Float32Array(NGLOB), globTh = new Float32Array(NGLOB), globZ = new Float32Array(NGLOB);
    for (let i = 0; i < NGLOB; i++) {
      globR[i] = 3 + Math.random() * 18;
      globTh[i] = Math.random() * 2 * Math.PI;
      globZ[i] = (Math.random() - 0.5) * 2 * globR[i] * 0.5;
    }
    const NSTARS = 2200;
    const starR = new Float32Array(NSTARS), starTh = new Float32Array(NSTARS), starZ = new Float32Array(NSTARS), starThick = new Uint8Array(NSTARS);
    for (let i = 0; i < NSTARS; i++) {
      const thick = Math.random() < 0.15;
      starThick[i] = thick ? 1 : 0;
      starR[i] = Math.pow(Math.random(), 0.6) * 15 + 0.3;
      starTh[i] = Math.random() * 2 * Math.PI;
      const hz = thick ? 1.0 : 0.3; // kpc scale height
      starZ[i] = (Math.random() - 0.5) * hz * 2 * (Math.random() < 0.7 ? 0.4 : 1);
    }

    const loop = new Loop(null, render, 1 / 30);

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const scale = (Math.min(W, H * 1.6) / 2 / 18) * 0.92;

      if (view === 'face') {
        // halo (faint scattered)
        ctx.fillStyle = pal.faint;
        for (let i = 0; i < 500; i++) {
          const r = Math.pow(Math.random(), 0.5) * 18, th = Math.random() * 2 * Math.PI;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(cx + r * Math.cos(th) * scale, cy + r * Math.sin(th) * scale, 1.4, 1.4);
        }
        ctx.globalAlpha = 1;
        // disk stars
        for (let i = 0; i < NSTARS; i++) {
          const r = starR[i], th = starTh[i];
          ctx.fillStyle = starThick[i] ? pal.series[3] : pal.series[1];
          ctx.globalAlpha = starThick[i] ? 0.35 : 0.6;
          ctx.fillRect(cx + r * Math.cos(th) * scale, cy + r * Math.sin(th) * scale, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
        // bar/bulge
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 2.8 * scale);
        g.addColorStop(0, pal.accent2); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, cy, 2.8 * scale, 1.1 * scale, 0.5, 0, 2 * Math.PI); ctx.fill();
        // globulars
        ctx.fillStyle = pal.bad;
        for (let i = 0; i < NGLOB; i++) {
          const x = cx + globR[i] * Math.cos(globTh[i]) * scale, y = cy + globR[i] * Math.sin(globTh[i]) * scale;
          ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill();
        }
        // Sun
        const sx = cx + 8.2 * scale, sy = cy;
        ctx.fillStyle = pal.fg;
        ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = pal.muted; ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText('Sun (R₀ ≈ 8.2 kpc)', sx + 8, sy - 6);
        ctx.fillText('GC', cx + 6, cy - 2.8 * scale - 4);
      } else {
        // edge-on
        for (let i = 0; i < 400; i++) {
          const r = Math.pow(Math.random(), 0.5) * 18 * (Math.random() < 0.5 ? 1 : -1);
          const z = (Math.random() - 0.5) * 22;
          ctx.fillStyle = pal.faint; ctx.globalAlpha = 0.3;
          ctx.fillRect(cx + r * scale, cy - z * scale * 0.5, 1.4, 1.4);
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < NSTARS; i++) {
          const r = starR[i] * Math.cos(starTh[i]);
          ctx.fillStyle = starThick[i] ? pal.series[3] : pal.series[1];
          ctx.globalAlpha = starThick[i] ? 0.35 : 0.6;
          ctx.fillRect(cx + r * scale, cy - starZ[i] * scale, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 2.5 * scale);
        g.addColorStop(0, pal.accent2); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, cy, 2.5 * scale, 0.9 * scale, 0, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = pal.bad;
        for (let i = 0; i < NGLOB; i++) {
          const x = cx + globR[i] * Math.cos(globTh[i]) * scale, y = cy - globZ[i] * scale;
          ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill();
        }
        const sx = cx + 8.2 * scale, sy = cy;
        ctx.fillStyle = pal.fg;
        ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = pal.muted; ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText('Sun, ~30 pc above the midplane', sx + 8, sy - 6);
        ctx.fillText('thin disk (h~300pc) · thick disk (h~1kpc, dim) · halo (faint) · bulge/bar · globulars (red)', 10, H - 10);
      }
    }

    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    panel.select('View', [{ value: 'face', label: 'Face-on' }, { value: 'edge', label: 'Edge-on' }], view, (v) => { view = v as any; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
