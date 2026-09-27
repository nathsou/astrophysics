// Secondary figure: transit geometry. Drag the planet's size, impact parameter and limb
// darkening; watch the disc-crossing animation and the resulting light curve, including
// grazing transits when b approaches 1 + Rp/R*. The disc view and the light curve share one
// geometry: the planet sits at x = (a/R*) sin(2π phase), y = b, in stellar radii.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyRGB } from '../lib/physics/blackbody';
import { transitDepthAt } from './exoplanets/lib';

const A_OVER_R = 30; // schematic a/R* (a hot Jupiter-ish orbit)
const PH_MAX = 0.009; // phase window shown: ±1.7 stellar radii from mid-transit
const U2 = 0.2; // fixed quadratic limb-darkening coefficient
const R_RATIO = 696000 / 6371; // R☉ / R⊕

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr);gap:8px;';
    host.append(wrap);
    const diskStage = createStage(wrap, { aspect: 1 });
    const lcStage = createStage(wrap, { aspect: 1.3 });
    const dctx = diskStage.canvas.getContext('2d')!;
    const lcPlot = new Plot(lcStage.canvas, {
      x: { min: -PH_MAX, max: PH_MAX, label: 'orbital phase from mid-transit' },
      y: { min: 0.985, max: 1.002, label: 'relative flux', format: (v) => v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') },
      margin: { l: 68, r: 14, t: 14, b: 42 },
    });

    const panel = new Panel(host);
    const rpCtl = panel.slider('Rp / R★', { min: 0.01, max: 0.25, value: 0.1, step: 0.001 }, () => loop.invalidate());
    const bCtl = panel.slider('Impact parameter b', { min: 0, max: 1.15, value: 0.3, step: 0.01 }, () => loop.invalidate());
    const u1Ctl = panel.slider('Limb darkening u₁', { min: 0, max: 0.9, value: 0.4, step: 0.01 }, () => loop.invalidate());
    const speedCtl = panel.slider('Speed', { min: 0.1, max: 3, value: 0.6 }, (v) => (loop.timeScale = v));
    const depthReadout = panel.readout('Max depth');
    const grazeReadout = panel.readout('Grazing?');

    const star = () => ({ radiusSun: 1, massSun: 1, tempK: 5800, limbU1: u1Ctl.get(), limbU2: U2 });
    const planet = (rp: number, b: number) => ({ periodDays: 1, radiusEarth: rp * R_RATIO, impactParam: b, t0Days: 0 });
    const [sr, sg, sb] = blackbodyRGB(5800);
    const starRGB = (I: number) => `rgb(${Math.round(255 * Math.min(1, sr * I))},${Math.round(255 * Math.min(1, sg * I))},${Math.round(255 * Math.min(1, sb * I))})`;
    let phase = -PH_MAX;
    const NC = 400;
    const curveX = new Float64Array(NC + 1), curveY = new Float64Array(NC + 1);
    let curveKey = '', maxDepth = 0;

    const loop = new Loop((dt) => { phase += dt * 0.006; if (phase > PH_MAX) phase = -PH_MAX; }, () => {
      const rp = rpCtl.get(), b = bCtl.get(), u1 = u1Ctl.get();
      const s = star(), pl = planet(rp, b);
      const grazing = b > 1 - rp && b < 1 + rp;
      grazeReadout.set(grazing ? 'yes — partial transit only' : b >= 1 + rp ? 'no transit (misses star)' : 'no');

      // --- disc view: a limb-darkened star, I(μ) = 1 − u₁(1−μ) − u₂(1−μ)² ---
      const w = diskStage.width, h = diskStage.height, dpr = diskStage.dpr;
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
      const grad = dctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      for (let k = 0; k <= 12; k++) {
        const r = k / 12, mu = Math.sqrt(Math.max(0, 1 - r * r));
        const I = 1 - u1 * (1 - mu) - U2 * (1 - mu) ** 2;
        grad.addColorStop(r, starRGB(I));
      }
      dctx.fillStyle = grad;
      dctx.beginPath(); dctx.arc(cx, cy, R, 0, 2 * Math.PI); dctx.fill();
      // transit chord, then the planet's silhouette at the same geometry the light curve uses
      const py = cy - b * R;
      dctx.strokeStyle = pal.faint; dctx.setLineDash([3, 3]); dctx.lineWidth = 1;
      dctx.beginPath(); dctx.moveTo(0, py); dctx.lineTo(w, py); dctx.stroke();
      dctx.setLineDash([]);
      const px = cx + A_OVER_R * Math.sin(2 * Math.PI * phase) * R;
      dctx.fillStyle = '#0b0b10';
      dctx.strokeStyle = pal.muted;
      dctx.beginPath(); dctx.arc(px, py, rp * R, 0, 2 * Math.PI); dctx.fill(); dctx.stroke();

      // --- light curve (y range follows the depth); the curve is recomputed only when a slider moves ---
      const key = `${rp}|${b}|${u1}`;
      if (key !== curveKey) {
        curveKey = key;
        maxDepth = 0;
        for (let i = 0; i <= NC; i++) {
          curveX[i] = -PH_MAX + (2 * PH_MAX * i) / NC;
          const d = transitDepthAt(curveX[i], pl, s, A_OVER_R);
          curveY[i] = 1 - d;
          maxDepth = Math.max(maxDepth, d);
        }
      }
      lcPlot.o.y.min = 1 - Math.max(0.004, maxDepth * 1.25);
      lcPlot.o.y.max = 1 + Math.max(0.004, maxDepth * 1.25) * 0.15;
      lcPlot.draw(() => {
        lcPlot.line(curveX, curveY, { color: pal.accent });
        lcPlot.point(phase, 1 - transitDepthAt(phase, pl, s, A_OVER_R), { color: pal.series[0], r: 5 });
      });
      depthReadout.set(`${fmt(maxDepth * 1e6, 3)} ppm (a uniform disc would give (Rp/R★)² = ${fmt(rp * rp * 1e6, 3)} ppm)`);
    }, 1 / 60);
    loop.timeScale = speedCtl.get();

    diskStage.onResize(() => loop.invalidate());
    lcStage.onResize((w, h, dpr) => { lcPlot.resize(w, h, dpr); loop.invalidate(); });

    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    onDestroy(() => loop.destroy());
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
