// Chapter 14 figure: a to-scale star size lineup, from a red dwarf to Betelgeuse, coloured by
// blackbody temperature. A zoom slider is unavoidable — R136a1 is roughly 2000× the radius of
// Proxima Centauri — so it defaults zoomed on the small end and lets you zoom out.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const STARS: { name: string; R: number; T: number }[] = [
  { name: 'Proxima Centauri (M dwarf)', R: 0.15, T: 3050 },
  { name: 'the Sun (G dwarf)', R: 1, T: 5772 },
  { name: 'Sirius A (A dwarf)', R: 1.71, T: 9940 },
  { name: 'Regulus (B subgiant)', R: 3.1, T: 12500 },
  { name: 'Pollux (K giant)', R: 9, T: 4666 },
  { name: 'Aldebaran (K giant)', R: 44, T: 3900 },
  { name: 'Betelgeuse (M supergiant)', R: 764, T: 3600 },
  { name: 'R136a1 (O hypergiant)', R: 32, T: 46000 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let zoom = 1; // R☉ per... controls how many R☉ fit across the panel scale factor
    let hoverIdx = -1;

    stage.overlay.style.pointerEvents = 'auto';
    stage.overlay.addEventListener('pointermove', (e) => {
      const rect = stage.overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      hoverIdx = pickIdx(mx);
      loop.invalidate();
    });
    stage.overlay.addEventListener('pointerleave', () => { hoverIdx = -1; loop.invalidate(); });

    let centers: number[] = [];
    let pxPerRsun = 1;

    function pickIdx(mx: number): number {
      for (let i = 0; i < STARS.length; i++) {
        const r = STARS[i].R * pxPerRsun;
        if (Math.abs(mx - centers[i]) < Math.max(r, 6)) return i;
      }
      return -1;
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const baseline = H * 0.72;
      const maxR = Math.max(...STARS.map((s) => s.R)) / zoom;
      pxPerRsun = (H * 0.62) / maxR;
      const gap = 14;
      let x = gap;
      centers = [];
      ctx.textAlign = 'center';
      for (const s of STARS) {
        const r = Math.max(1.5, s.R * pxPerRsun);
        centers.push(x + r);
        x += 2 * r + gap;
      }
      const totalW = x;
      ctx.save();
      ctx.translate((W - totalW) / 2, 0);
      for (let i = 0; i < centers.length; i++) centers[i] += (W - totalW) / 2;
      STARS.forEach((s, i) => {
        const r = Math.max(1.5, s.R * pxPerRsun);
        const cx = centers[i];
        const g = ctx.createRadialGradient(cx - r * 0.3, baseline - r * 0.3, 0, cx, baseline, r);
        g.addColorStop(0, blackbodyCSS(s.T, 1));
        g.addColorStop(1, blackbodyCSS(s.T, 0.75));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, baseline, r, 0, Math.PI * 2);
        ctx.fill();
        if (i === hoverIdx) { ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.stroke(); }
      });
      ctx.restore();
      ctx.fillStyle = pal.muted;
      ctx.font = '12px Inter, system-ui, sans-serif';
      if (hoverIdx >= 0) {
        const s = STARS[hoverIdx];
        ctx.fillStyle = pal.fg;
        ctx.fillText(`${s.name}: ${fmt(s.R, 3)} R☉, ${Math.round(s.T)} K`, W / 2, 20);
      } else {
        ctx.fillText('Hover a star for its radius and temperature.', W / 2, 20);
      }
    }
    const loop = new Loop(null, render);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Zoom out ×', { min: 1, max: 800, value: zoom, log: true, format: (v) => fmt(v, 3) }, (v) => { zoom = v; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
