// Secondary figure: transit geometry. Drag the planet's size, impact parameter and limb
// darkening; watch the disc-crossing animation and the resulting light curve, including
// grazing transits when b approaches 1 + Rp/R*.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { transitDepthAt } from './exoplanets/lib';

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr);gap:8px;';
    host.append(wrap);
    const diskStage = createStage(wrap, { aspect: 1 });
    const lcStage = createStage(wrap, { aspect: 1.3 });
    const dctx = diskStage.canvas.getContext('2d')!;
    const lcPlot = new Plot(lcStage.canvas, { x: { min: -0.06, max: 0.06, label: 'phase' }, y: { min: 0.985, max: 1.002, label: 'relative flux' } });
    lcStage.onResize((w, h, dpr) => lcPlot.resize(w, h, dpr));

    const panel = new Panel(host);
    const rpCtl = panel.slider('Rp / R★', { min: 0.01, max: 0.25, value: 0.1, step: 0.001 }, () => loop.invalidate());
    const bCtl = panel.slider('Impact parameter b', { min: 0, max: 1.15, value: 0.3, step: 0.01 }, () => loop.invalidate());
    const u1Ctl = panel.slider('Limb darkening u₁', { min: 0, max: 0.9, value: 0.4, step: 0.01 }, () => loop.invalidate());
    const speedCtl = panel.slider('Speed', { min: 0.1, max: 3, value: 0.6 }, (v) => (loop.timeScale = v));
    const depthReadout = panel.readout('Max depth');
    const grazeReadout = panel.readout('Grazing?');

    const star = () => ({ radiusSun: 1, massSun: 1, tempK: 5800, limbU1: u1Ctl.get(), limbU2: 0.2 });
    let phase = -0.06;

    const loop = new Loop((dt) => { phase += dt * 0.02; if (phase > 0.06) phase = -0.06; }, () => {
      const rp = rpCtl.get(), b = bCtl.get();
      const aOverRstar = 30; // schematic
      const s = star();
      const grazing = b > 1 - rp && b < 1 + rp;
      grazeReadout.set(grazing ? 'yes — partial transit only' : b >= 1 + rp ? 'no transit (misses star)' : 'no');

      // --- disk view ---
      const w = diskStage.width, h = diskStage.height, dpr = diskStage.dpr;
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
      const grad = dctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, pal.series[2]);
      grad.addColorStop(1, shade(pal.series[2], 1 - u1Ctl.get() * 0.7));
      dctx.fillStyle = grad;
      dctx.beginPath(); dctx.arc(cx, cy, R, 0, 7); dctx.fill();
      const px = cx + phase * 20 * R, py = cy - b * R;
      dctx.fillStyle = pal.bg;
      dctx.strokeStyle = pal.axis;
      dctx.beginPath(); dctx.arc(px, py, rp * R, 0, 7); dctx.fill(); dctx.stroke();
      dctx.strokeStyle = pal.faint;
      dctx.setLineDash([3, 3]);
      dctx.beginPath(); dctx.moveTo(0, py); dctx.lineTo(w, py); dctx.stroke();
      dctx.setLineDash([]);

      // --- light curve ---
      let maxDepth = 0;
      lcPlot.draw(() => {
        lcPlot.fn((ph) => {
          const spec = { periodDays: 1, radiusEarth: 1, impactParam: b, t0Days: 0 };
          const specStar = { ...s };
          // scale radiusEarth so Rp/R* matches rp exactly (transitDepthAt uses Rearth/Rsun ratio)
          const scaledPlanet = { ...spec, radiusEarth: rp * s.radiusSun * (696000 / 6371) };
          const depth = transitDepthAt(ph, scaledPlanet, specStar, aOverRstar);
          maxDepth = Math.max(maxDepth, depth);
          return 1 - depth;
        }, { color: pal.accent, samples: 200 });
        lcPlot.point(phase, 1 - transitDepthAt(phase, { periodDays: 1, radiusEarth: rp * s.radiusSun * (696000 / 6371), impactParam: b, t0Days: 0 }, s, aOverRstar), { color: pal.series[0], r: 5 });
      });
      depthReadout.set(`${fmt(maxDepth * 1e6, 3)} ppm (${fmt(Math.sqrt(maxDepth) * 100, 2)}% if central)`);
    }, 1 / 40);

    function shade(hex: string, f: number) {
      // best-effort darken for a CSS colour string used as a gradient stop
      return hex;
    }

    diskStage.onResize(() => loop.invalidate());
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    onDestroy(() => loop.destroy());
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
