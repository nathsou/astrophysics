// Chapter 14 figure: a to-scale star size lineup, from a red dwarf to Betelgeuse, coloured by
// blackbody temperature. A zoom slider is unavoidable — Betelgeuse is roughly 5000× the radius of
// Proxima Centauri — so it opens showing everything and lets you zoom in on the small end.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

// Sorted by radius, so zooming in keeps the small end in view.
const STARS: { name: string; short: string; R: number; T: number }[] = [
  { name: 'Proxima Centauri (M dwarf)', short: 'Proxima', R: 0.15, T: 3050 },
  { name: 'the Sun (G dwarf)', short: 'Sun', R: 1, T: 5772 },
  { name: 'Sirius A (A dwarf)', short: 'Sirius A', R: 1.71, T: 9940 },
  { name: 'Regulus (B dwarf, fast rotator)', short: 'Regulus', R: 3.1, T: 12500 },
  { name: 'Pollux (K giant)', short: 'Pollux', R: 9, T: 4666 },
  { name: 'R136a1 (Wolf–Rayet, the most massive star known)', short: 'R136a1', R: 39, T: 46000 },
  { name: 'Aldebaran (K giant)', short: 'Aldebaran', R: 44, T: 3900 },
  { name: 'Betelgeuse (M supergiant)', short: 'Betelgeuse', R: 764, T: 3600 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let zoom = 1; // magnification relative to the view that fits Betelgeuse
    let hoverIdx = -1;

    stage.overlay.style.pointerEvents = 'auto';
    const pick = (e: PointerEvent) => {
      const rect = stage.overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      hoverIdx = pickIdx(mx);
      loop.invalidate();
    };
    stage.overlay.addEventListener('pointermove', pick);
    stage.overlay.addEventListener('pointerdown', pick); // a tap on touch screens
    stage.overlay.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hoverIdx = -1; loop.invalidate(); } });

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
      const baseline = H * 0.5;
      const maxR = Math.max(...STARS.map((s) => s.R));
      pxPerRsun = ((H * 0.4) / maxR) * zoom;
      const gap = 16;
      let x = gap;
      centers = [];
      for (const s of STARS) {
        const r = Math.max(1.5, s.R * pxPerRsun);
        centers.push(x + r);
        x += 2 * r + gap;
      }
      const totalW = x;
      const shift = totalW <= W ? (W - totalW) / 2 : 0; // once it overflows, keep the small end in view
      for (let i = 0; i < centers.length; i++) centers[i] += shift;
      ctx.save();
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
        else if (r < 12) {
          // pale blue-white dots vanish on the cream paper: give small stars a thin ink rim
          ctx.beginPath(); ctx.arc(cx, baseline, r + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = pal.muted; ctx.lineWidth = 1; ctx.stroke();
        }
      });
      // Name labels under the stars small enough to leave room. One straight row when they fit;
      // on narrow screens they would collide, so they are set on a slant (like a crowded chart axis),
      // each starting right under its own star so the pairing stays unambiguous.
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.muted;
      const shown = STARS.map((s, i) => ({ s, i, r: Math.max(1.5, s.R * pxPerRsun), w: ctx.measureText(s.short).width }))
        .filter((o) => baseline + o.r + 30 <= H && centers[o.i] >= 0 && centers[o.i] <= W);
      let right = -Infinity, straight = true;
      for (const o of shown) {
        if (centers[o.i] - o.w / 2 <= right + 8 || centers[o.i] + o.w / 2 > W - 2) { straight = false; break; }
        right = centers[o.i] + o.w / 2;
      }
      // does a slanted label starting at (x0, y0) run into another star's disc?
      const hits = (o: typeof shown[number], x0: number, y0: number, a: number) => {
        for (let t = 0; t <= o.w; t += 4) {
          const x = x0 + t * Math.cos(a), y = y0 + t * Math.sin(a);
          if (y > H - 2 || x > W - 2) return true;
          for (let j = 0; j < STARS.length; j++) {
            if (j === o.i) continue;
            const rj = Math.max(1.5, STARS[j].R * pxPerRsun) + 3;
            if ((x - centers[j]) ** 2 + (y - baseline) ** 2 < rj * rj) return true;
          }
        }
        return false;
      };
      for (const o of shown) {
        const cx = centers[o.i];
        if (straight) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(o.s.short, cx, baseline + o.r + 16);
          continue;
        }
        const x0 = cx - 3, y0 = baseline + o.r + 7;
        const a = [Math.PI / 4, Math.PI / 3, (5 * Math.PI) / 12].find((ang) => !hits(o, x0, y0, ang));
        if (a === undefined) continue;
        ctx.save();
        ctx.translate(x0, y0);
        ctx.rotate(a);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.s.short, 0, 0);
        ctx.restore();
      }
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      if (hoverIdx >= 0) {
        const s = STARS[hoverIdx];
        ctx.fillStyle = pal.fg;
        const line = `${s.name}: ${fmt(s.R, 3)} R☉, ${Math.round(s.T)} K`;
        if (ctx.measureText(line).width <= W - 16) ctx.fillText(line, W / 2, 20);
        else {
          // too long for a phone: name on one line, numbers on the next
          ctx.fillText(s.name, W / 2, 20);
          ctx.fillText(`${fmt(s.R, 3)} R☉ · ${Math.round(s.T)} K`, W / 2, 36);
        }
      } else {
        ctx.fillStyle = pal.muted;
        ctx.fillText(matchMedia('(hover: none)').matches ? 'Tap a star for its radius and temperature.' : 'Hover a star for its radius and temperature.', W / 2, 20);
      }
    }
    const loop = new Loop(null, render);
    loop.onDemand = true; // static figure: redraw only on invalidate()
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Zoom in ×', { min: 1, max: 300, value: zoom, log: true, format: (v) => fmt(v, 3) }, (v) => { zoom = v; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
