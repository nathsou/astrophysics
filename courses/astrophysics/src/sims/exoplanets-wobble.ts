// Secondary figure: top-down barycentric wobble of a star tugged by an unseen planet, synced
// with the resulting radial-velocity curve and a schematic Doppler shift of a spectral line.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { rvSemiAmplitude } from './exoplanets/lib';

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.3fr);gap:8px;';
    host.append(wrap);

    const orbitStage = createStage(wrap, { aspect: 1 });
    const rightCol = document.createElement('div');
    rightCol.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    wrap.append(rightCol);
    const rvStage = createStage(rightCol, { aspect: 3 });
    const lineStage = createStage(rightCol, { aspect: 6, height: 60 });

    const octx = orbitStage.canvas.getContext('2d')!;
    const lctx = lineStage.canvas.getContext('2d')!;
    const rvPlot = new Plot(rvStage.canvas, { x: { min: 0, max: 2, label: 'orbital phase' }, y: { min: -15, max: 15, label: 'RV (m/s)' } });
    rvStage.onResize((w, h, dpr) => rvPlot.resize(w, h, dpr));

    const panel = new Panel(host);
    const mStarCtl = panel.slider('Star mass', { min: 0.3, max: 2, value: 1, unit: 'M☉' }, () => reset());
    const mpCtl = panel.slider('Planet mass', { min: 1, max: 5000, value: 318, log: true, unit: 'M⊕' }, () => reset());
    const eCtl = panel.slider('Eccentricity', { min: 0, max: 0.8, value: 0, step: 0.01 }, () => reset());
    const speedCtl = panel.slider('Speed', { min: 0.1, max: 4, value: 1 }, (v) => (loop.timeScale = v));
    const kReadout = panel.readout('K (star)');

    const series = new Series(600);
    let K = 0;
    function reset() {
      K = rvSemiAmplitude(365.25, mStarCtl.get(), mpCtl.get(), 90, eCtl.get());
      kReadout.set(`${fmt(K, 3)} m/s`);
      series.clear();
      loop.invalidate();
    }

    let phase = 0;
    const loop = new Loop((dt) => { phase = (phase + dt * 0.25) % 1; }, () => {
      const e = eCtl.get();
      // true anomaly via a couple of Newton iterations on Kepler's equation (M -> E -> theta)
      const M = 2 * Math.PI * phase;
      let E = M;
      for (let i = 0; i < 5; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      const theta = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      const mStar = mStarCtl.get(), mp = mpCtl.get() / 332946; // Earth masses -> solar
      const rStar = (mp / (mStar + mp)); // fraction of separation the star swings through, arbitrary units
      const rPlanet = mStar / (mStar + mp);

      // --- orbit view ---
      const w = orbitStage.width, h = orbitStage.height, dpr = orbitStage.dpr;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.38;
      const a = 1 / (1 + e * Math.cos(theta)); // r(theta) with semi-major axis 1
      const x = a * Math.cos(theta), y = a * Math.sin(theta);
      octx.strokeStyle = pal.faint;
      octx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const th = (i / 128) * 2 * Math.PI;
        const r = (1 - e * e) / (1 + e * Math.cos(th));
        const px = cx + r * Math.cos(th) * scale * rPlanet, py = cy + r * Math.sin(th) * scale * rPlanet;
        i === 0 ? octx.moveTo(px, py) : octx.lineTo(px, py);
      }
      octx.stroke();
      octx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const th = (i / 128) * 2 * Math.PI + Math.PI;
        const r = (1 - e * e) / (1 + e * Math.cos(th - Math.PI));
        const px = cx + r * Math.cos(th) * scale * rStar * 12, py = cy + r * Math.sin(th) * scale * rStar * 12;
        i === 0 ? octx.moveTo(px, py) : octx.lineTo(px, py);
      }
      octx.strokeStyle = pal.accent2;
      octx.stroke();
      // barycentre
      octx.fillStyle = pal.muted;
      octx.beginPath(); octx.arc(cx, cy, 2, 0, 7); octx.fill();
      // star position (exaggerated ×12 so the wobble is visible)
      const sx = cx - rStar * 12 * scale * Math.cos(theta), sy = cy - rStar * 12 * scale * Math.sin(theta);
      octx.fillStyle = pal.series[2];
      octx.beginPath(); octx.arc(sx, sy, 9, 0, 7); octx.fill();
      // planet position
      const px2 = cx + rPlanet * scale * Math.cos(theta), py2 = cy + rPlanet * scale * Math.sin(theta);
      octx.fillStyle = pal.series[0];
      octx.beginPath(); octx.arc(px2, py2, 4, 0, 7); octx.fill();
      octx.fillStyle = pal.muted;
      octx.font = '11px JetBrains Mono, ui-monospace, monospace';
      octx.fillText('star wobble ×12 (true amplitude is far smaller)', 8, h - 8);

      // --- RV curve --- RV(theta) ∝ cos(theta+omega) + e cos(omega); take omega = 0 here.
      const rvSimple = K * (Math.cos(theta) + e);
      series.push(phase, rvSimple);
      rvPlot.o.y.max = Math.max(5, K * 1.3); rvPlot.o.y.min = -rvPlot.o.y.max;
      rvPlot.draw(() => {
        rvPlot.fn((ph) => {
          const MM = 2 * Math.PI * ph; let EE = MM;
          for (let i = 0; i < 5; i++) EE -= (EE - e * Math.sin(EE) - MM) / (1 - e * Math.cos(EE));
          const th = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(EE / 2), Math.sqrt(1 - e) * Math.cos(EE / 2));
          return K * (Math.cos(th) + e);
        }, { color: pal.faint, dash: [3, 3] });
        rvPlot.hline(0, { color: pal.grid });
        rvPlot.point(phase, rvSimple, { color: pal.accent, r: 5 });
      });

      // --- spectral line Doppler shift ---
      const lw = lineStage.width, lh = lineStage.height, ldpr = lineStage.dpr;
      lctx.setTransform(ldpr, 0, 0, ldpr, 0, 0);
      lctx.clearRect(0, 0, lw, lh);
      lctx.strokeStyle = pal.grid;
      lctx.beginPath(); lctx.moveTo(0, lh / 2); lctx.lineTo(lw, lh / 2); lctx.stroke();
      const shift = (rvSimple / K || 0) * lw * 0.06;
      const cxl = lw / 2 + shift;
      const grad = lctx.createLinearGradient(cxl - 30, 0, cxl + 30, 0);
      grad.addColorStop(0, rvSimple > 0 ? pal.bad : pal.accent2);
      grad.addColorStop(0.5, pal.bg);
      grad.addColorStop(1, rvSimple > 0 ? pal.bad : pal.accent2);
      lctx.fillStyle = grad;
      lctx.fillRect(cxl - 30, 4, 60, lh - 8);
      lctx.fillStyle = pal.fg;
      lctx.fillRect(cxl - 2, 2, 4, lh - 4);
      lctx.font = '10px JetBrains Mono, ui-monospace, monospace';
      lctx.fillStyle = pal.muted;
      lctx.fillText(rvSimple > 0 ? 'redshifted (receding)' : 'blueshifted (approaching)', 4, 12);
    }, 1 / 60);

    orbitStage.onResize(() => loop.invalidate());
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    reset();
    onDestroy(() => loop.destroy());
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
