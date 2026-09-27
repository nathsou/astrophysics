// Chapter 14 flagship: an aging star cluster. Sample a few thousand stars from a Kroupa IMF,
// place them on the ZAMS, then age the whole population by evaluating evolveStar(M, t) fresh
// every frame — the state is a pure function of (mass, age), so scrubbing time is exact and
// cheap (a few thousand closed-form evaluations, nowhere near GPU territory).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange, currentTheme } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';
import { sampleKroupaMass, mulberry32, zamsL, zamsR, teffFromLR, evolveStar, turnoffMass, Tsun } from './main-sequence/zams';

const logTsun = Math.log10(Tsun);
const N = 3000;

const PRESETS: { label: string; ageMyr: number }[] = [
  { label: 'Pleiades (100 Myr)', ageMyr: 100 },
  { label: 'Hyades (625 Myr)', ageMyr: 625 },
  { label: 'M67 (4 Gyr)', ageMyr: 4000 },
  { label: '47 Tuc (12 Gyr)', ageMyr: 12000 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); redraw(); });
    const redraw = () => { dirty = true; loop.invalidate(); };

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:0;';
    host.append(wrap);
    const hrStage = createStage(wrap, { aspect: 4 / 3 });
    const imgStage = createStage(wrap, { aspect: 4 / 3 });
    hrStage.el.style.borderRight = '1px solid var(--rule)';
    const imgCtx = imgStage.canvas.getContext('2d')!;

    const plot = new Plot(hrStage.canvas, {
      x: { min: -Math.log10(55000), max: -Math.log10(2400), label: 'Tₑff (K) — increasing to the left', format: (v) => String(Math.round(10 ** -v)), ticks: [40000, 20000, 10000, 6000, 4000, 3000].map((T) => -Math.log10(T)) },
      y: { min: -4.2, max: 6.2, label: 'log(L / L☉)' },
      title: 'HR diagram',
    });

    let seed = 1234;
    let masses = new Float64Array(N);
    const positions: { x: number; y: number }[] = [];
    function resample() {
      const rng = mulberry32(seed);
      for (let i = 0; i < N; i++) masses[i] = sampleKroupaMass(rng);
      positions.length = 0;
      for (let i = 0; i < N; i++) {
        const r = Math.sqrt(rng()) * 0.95;
        const a = rng() * Math.PI * 2;
        positions.push({ x: 0.5 + 0.5 * r * Math.cos(a), y: 0.5 + 0.5 * r * Math.sin(a) });
      }
    }
    resample();

    let ageMyr = 100;
    let playing = false;
    const playRateDex = 0.12; // dex of age per second

    const xData = (T: number) => -Math.log10(T);

    // Redraw only when something changed: every frame while playing, otherwise on demand.
    let dirty = true;
    function render() {
      if (!dirty && !playing) return;
      dirty = false;
      const ageYr = ageMyr * 1e6;
      // HR diagram
      plot.draw(() => {
        // lines of constant radius: log L = 2 logR - 4 logTsun - 4·xData
        for (const R of [0.01, 0.1, 1, 10, 100, 1000]) {
          const logR = Math.log10(R);
          plot.fn((xd) => 2 * logR - 4 * logTsun - 4 * xd, { color: pal.grid, dash: [2, 4], width: 1 });
          const xLabel = plot.o.x.max + (plot.o.x.min - plot.o.x.max) * 0.03;
          const yLabel = 2 * logR - 4 * logTsun - 4 * xLabel;
          if (yLabel > plot.o.y.min && yLabel < plot.o.y.max) plot.text(`${fmt(R, 2)} R☉`, plot.px(xLabel), plot.py(yLabel) - 3, { color: pal.faint, size: 10, align: 'right' });
        }
        const edge = currentTheme() === 'light' ? 'rgba(40,36,30,0.45)' : undefined; // outline pale stars on paper
        let nWD = 0, nSN = 0;
        let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
        for (let i = 0; i < N; i++) {
          const s = evolveStar(masses[i], ageYr);
          if (s.phase === 'gone') { nSN++; continue; }
          if (s.phase === 'wd') nWD++;
          if (s.phase === 'sn') nSN++;
          const logL = Math.log10(Math.max(s.L, 1e-6));
          const col = blackbodyCSS(s.T);
          plot.point(xData(s.T), logL, { r: s.phase === 'ms' ? 1.6 : s.phase === 'wd' ? 1.4 : 2.4, color: col, stroke: edge });
          const w = Math.max(s.L, 1e-6);
          // rough sRGB from blackbody for the integrated-colour readout
          const rgb = col.match(/\d+/g)!.map(Number);
          sumR += rgb[0] * w; sumG += rgb[1] * w; sumB += rgb[2] * w; sumW += w;
        }
        // turn-off marker
        const Mto = turnoffMass(ageYr);
        const Lto = zamsL(Mto), Tto = teffFromLR(Lto, zamsR(Mto));
        plot.vline(xData(Tto), { color: pal.accent2, width: 1 });
        readouts.ageOut.set(ageMyr < 1000 ? `${fmt(ageMyr, 3)} Myr` : `${fmt(ageMyr / 1000, 3)} Gyr`);
        readouts.toOut.set(`${fmt(Mto, 3)} M☉`);
        readouts.wdOut.set(String(nWD));
        readouts.snOut.set(String(nSN));
        if (sumW > 0) {
          const r = Math.round(sumR / sumW), g = Math.round(sumG / sumW), b = Math.round(sumB / sumW);
          readouts.colorSwatch.style.background = `rgb(${r},${g},${b})`;
        }
      });

      // cluster image
      const { width: W, height: H, dpr } = imgStage;
      imgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      imgCtx.globalCompositeOperation = 'source-over';
      imgCtx.fillStyle = '#05060a'; // night sky in both themes
      imgCtx.fillRect(0, 0, W, H);
      imgCtx.globalCompositeOperation = 'lighter';
      const S = Math.min(W, H), ox = (W - S) / 2, oy = (H - S) / 2; // keep the cluster round
      for (let i = 0; i < N; i++) {
        const s = evolveStar(masses[i], ageYr);
        if (s.phase === 'gone') continue;
        const p = positions[i];
        const rad = Math.max(0.5, Math.min(6, 0.7 + 0.55 * Math.log10(Math.max(s.L, 1e-3) + 1)));
        const col = blackbodyCSS(s.T, s.phase === 'sn' ? 1 : 0.85);
        const px = ox + p.x * S, py = oy + p.y * S;
        const g = imgCtx.createRadialGradient(px, py, 0, px, py, rad * (s.phase === 'sn' ? 6 : 2.2));
        g.addColorStop(0, col);
        g.addColorStop(1, blackbodyCSS(s.T, 0));
        imgCtx.fillStyle = g;
        imgCtx.beginPath();
        imgCtx.arc(px, py, rad * (s.phase === 'sn' ? 6 : 2.2), 0, Math.PI * 2);
        imgCtx.fill();
      }
      imgCtx.globalCompositeOperation = 'source-over';
    }

    const loop = new Loop((dt) => {
      if (playing) {
        ageMyr *= Math.pow(10, playRateDex * dt);
        if (ageMyr > 16000) ageMyr = 1;
        ageSlider.set(ageMyr, false);
      }
    }, render, 1 / 30);

    hrStage.onResize((w, h, d) => { plot.resize(w, h, d); redraw(); });
    imgStage.onResize(() => redraw());

    const panel = new Panel(host);
    const ageSlider = panel.slider('Age', { min: 1, max: 16000, value: ageMyr, log: true, format: (v) => (v < 1000 ? `${fmt(v, 3)} Myr` : `${fmt(v / 1000, 3)} Gyr`) }, (v) => { ageMyr = v; redraw(); });
    panel.playPause(() => !playing, (p) => { playing = !p; });
    panel.button('Resample IMF', () => { seed = (seed * 2654435761) >>> 0; resample(); redraw(); });
    panel.select('Preset', PRESETS.map((p) => ({ value: p.label, label: p.label })), PRESETS[0].label, (v) => {
      const p = PRESETS.find((x) => x.label === v)!;
      ageMyr = p.ageMyr; ageSlider.set(ageMyr, false); redraw();
    });

    const readouts = {
      ageOut: panel.readout('Age'),
      toOut: panel.readout('Turn-off mass'),
      wdOut: panel.readout('White dwarfs'),
      snOut: panel.readout('Supernovae'),
      colorSwatch: document.createElement('span'),
    };
    const swatchWrap = document.createElement('div');
    swatchWrap.className = 'readout';
    const lbl = document.createElement('span'); lbl.textContent = 'Integrated colour ';
    readouts.colorSwatch.style.cssText = 'display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;border:1px solid var(--rule)';
    swatchWrap.append(lbl, readouts.colorSwatch);
    panel.el.append(swatchWrap);

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
