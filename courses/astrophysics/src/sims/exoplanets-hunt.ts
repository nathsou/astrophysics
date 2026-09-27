// Flagship sim: "find the planet yourself". Generates a synthetic noisy light curve (and,
// on a second tab, radial-velocity data) for a hidden planet, lets the reader run a chunked
// Box Least Squares / Lomb-Scargle periodogram, click the peak, phase-fold, and read off the
// planet's radius, semi-major axis, period and equilibrium temperature.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import {
  mulberry32, generateLightCurve, generateRV, createBLS, createLombScargle,
  semiMajorAxisAU, equilibriumTempK, rvSemiAmplitude, transitDepthAt,
  Rsun, Rearth, AU, type SystemSpec,
} from './exoplanets/lib';

function randomSystem(seed: number, nPlanets: 1 | 2): SystemSpec {
  const rng = mulberry32(seed);
  const star = {
    radiusSun: 0.7 + rng() * 0.6,
    massSun: 0.7 + rng() * 0.5,
    tempK: 4800 + rng() * 2200,
    limbU1: 0.35, limbU2: 0.25,
  };
  const planets = Array.from({ length: nPlanets }, (_, i) => {
    const periodDays = 1.5 * Math.pow(15, rng()) * (i === 0 ? 1 : 3 + rng() * 4);
    const radiusEarth = 0.8 + rng() * rng() * 12;
    return { periodDays, radiusEarth, impactParam: rng() * 0.85, t0Days: rng() * periodDays };
  }).sort((a, b) => a.periodDays - b.periodDays);
  return { star, planets };
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();

    const root = document.createElement('div');
    root.className = 'exo-hunt';
    root.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    host.append(root);

    // --- tabs ---
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:6px;';
    const tabPhot = document.createElement('button');
    const tabRV = document.createElement('button');
    tabPhot.className = 'btn primary'; tabRV.className = 'btn';
    tabPhot.textContent = 'Photometry (transits)';
    tabRV.textContent = 'Radial velocity';
    tabs.append(tabPhot, tabRV);
    root.append(tabs);

    const photView = document.createElement('div');
    const rvView = document.createElement('div');
    rvView.style.display = 'none';
    root.append(photView, rvView);

    let mode: 'phot' | 'rv' = 'phot';
    function setMode(m: 'phot' | 'rv') {
      mode = m;
      if (m === 'rv') rvRedraw(); else redraw();
      photView.style.display = m === 'phot' ? '' : 'none';
      rvView.style.display = m === 'rv' ? '' : 'none';
      tabPhot.className = m === 'phot' ? 'btn primary' : 'btn';
      tabRV.className = m === 'rv' ? 'btn primary' : 'btn';
    }
    tabPhot.addEventListener('click', () => setMode('phot'));
    tabRV.addEventListener('click', () => setMode('rv'));

    // ============================== PHOTOMETRY ==============================
    const rawStage = createStage(photView, { aspect: 3.2 });
    const rawPlot = new Plot(rawStage.canvas, { x: { min: 0, max: 40, label: 'time (days)' }, y: { min: 0.98, max: 1.01, label: 'relative flux' } });
    rawStage.onResize((w, h, dpr) => rawPlot.resize(w, h, dpr));

    const blsRow = document.createElement('div');
    blsRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    photView.append(blsRow);
    const blsStage = createStage(blsRow, { aspect: 1.5 });
    const foldStage = createStage(blsRow, { aspect: 1.5 });
    const blsPlot = new Plot(blsStage.canvas, { x: { min: 0.5, max: 60, log: true, label: 'trial period (days)' }, y: { min: 0, max: 1, label: 'BLS power (relative)', format: () => '' }, title: 'Periodogram — click a peak' });
    const foldPlot = new Plot(foldStage.canvas, { x: { min: -0.1, max: 0.1, label: 'phase' }, y: { min: 0.98, max: 1.01, label: 'relative flux' }, title: 'Phase-folded' });
    blsStage.onResize((w, h, dpr) => blsPlot.resize(w, h, dpr));
    foldStage.onResize((w, h, dpr) => foldPlot.resize(w, h, dpr));

    const panel = new Panel(photView);
    const noiseCtl = panel.slider('Noise level', { min: 0.0002, max: 0.006, value: 0.0008, log: true, unit: 'ppm', format: (v) => fmt(v * 1e6, 3) }, () => regen());
    const nTransitCtl = panel.slider('Baseline (days)', { min: 10, max: 120, value: 45, step: 5 }, () => regen());
    const twoPlanets = panel.toggle('Two planets', false, () => regen());
    const runBtn = panel.button('Run BLS', () => startScan(), true);
    const newBtn = panel.button('New system', () => { seed = Math.floor(Math.random() * 1e9); regen(); });
    const revealBtn = panel.button('Reveal answer', () => {
      revealed = !revealed;
      if (revealed) status.set('Answer: ' + system.planets.map((p) => `P = ${fmt(p.periodDays, 4)} d, Rp = ${fmt(p.radiusEarth, 3)} R⊕`).join('; '));
      else status.set(scan ? 'Click a peak to phase-fold at that period.' : 'Data generated — run BLS to search for periodic dips.');
      redraw();
    });
    const status = panel.readout('Status');
    const rMeas = panel.readout('Rp (measured)');
    const aMeas = panel.readout('a (measured)');
    const pMeas = panel.readout('P (measured)');
    const teqMeas = panel.readout('T_eq (measured)');

    let seed = 7; // a default system whose (sub-Neptune) transit BLS recovers at the default noise
    let system = randomSystem(seed, 1);
    let lc = generateLightCurve({ system, baselineDays: nTransitCtl.get(), cadenceMinutes: 20, noiseLevel: noiseCtl.get(), activityLevel: 0.0006, gapFraction: 0.08, seed });
    // Detrending: divide by a running median over ±0.4 d. That window is several transit durations
    // wide, so it follows the star's slow rotational variability but not the few-hour dips.
    // `shown`/`det` hold NaN in data gaps so the plots skip them.
    let trend = new Float64Array(0), det = new Float64Array(0), shown = new Float64Array(0);
    function detrend() {
      const n = lc.t.length, half = 0.4;
      trend = new Float64Array(n); det = new Float64Array(n); shown = new Float64Array(n);
      let lo = 0, hi = 0;
      const win: number[] = [];
      for (let i = 0; i < n; i++) {
        while (lc.t[lo] < lc.t[i] - half) lo++;
        while (hi < n && lc.t[hi] <= lc.t[i] + half) hi++;
        win.length = 0;
        for (let k = lo; k < hi; k++) if (lc.mask[k]) win.push(lc.flux[k]);
        win.sort((p, q) => p - q);
        trend[i] = win.length && lc.mask[i] ? win[win.length >> 1] : NaN;
        det[i] = lc.mask[i] && win.length ? lc.flux[i] / trend[i] : NaN;
        shown[i] = lc.mask[i] ? lc.flux[i] : NaN;
      }
    }
    detrend();
    let scan: ReturnType<typeof createBLS> | null = null;
    let scanning = false;
    let selectedPeriod: number | null = null;
    let revealed = false;

    function regen() {
      system = randomSystem(seed, twoPlanets.get() ? 2 : 1);
      lc = generateLightCurve({ system, baselineDays: nTransitCtl.get(), cadenceMinutes: 20, noiseLevel: noiseCtl.get(), activityLevel: 0.0006, gapFraction: 0.08, seed });
      detrend();
      scan = null; selectedPeriod = null; revealed = false;
      status.set('Data generated — run BLS to search for periodic dips.');
      redraw();
    }

    function startScan() {
      scan = createBLS(lc.t, det, lc.mask, 0.5, Math.min(60, nTransitCtl.get() / 2), 1400);
      scanning = true;
      status.set('Scanning periods…');
    }

    blsStage.canvas.addEventListener('click', (ev) => {
      if (!scan) return;
      const r = blsStage.canvas.getBoundingClientRect();
      const P = blsPlot.dx((ev.clientX - r.left));
      // snap to nearest scanned period with locally maximal power
      let best = 0, bestD = Infinity;
      for (let i = 0; i < scan.periods.length; i++) {
        const d = Math.abs(Math.log(scan.periods[i] / P));
        if (d < bestD) { bestD = d; best = i; }
      }
      selectedPeriod = scan.periods[best];
      redraw();
    });

    function measureFromFold(P: number) {
      // crude depth/duration read-off from the folded, binned curve
      const nb = 200;
      const sum = new Float64Array(nb), cnt = new Float64Array(nb);
      for (let i = 0; i < lc.t.length; i++) {
        if (!lc.mask[i]) continue;
        let ph = (lc.t[i] / P) % 1; if (ph < 0) ph += 1;
        if (ph > 0.5) ph -= 1;
        const b = Math.min(nb - 1, Math.max(0, Math.floor((ph + 0.5) * nb)));
        if (!Number.isFinite(det[i])) continue;
        sum[b] += det[i]; cnt[b] += 1;
      }
      const binned = Array.from({ length: nb }, (_, b) => (cnt[b] ? sum[b] / cnt[b] : NaN));
      const baseline = binned.filter((v) => Number.isFinite(v)).sort((a, b) => b - a).slice(0, Math.floor(nb * 0.6)).reduce((a, b) => a + b, 0) / Math.floor(nb * 0.6);
      let depth = 0, minB = -1;
      for (let b = 0; b < nb; b++) if (Number.isFinite(binned[b]) && baseline - binned[b] > depth) { depth = baseline - binned[b]; minB = b; }
      let width = 0;
      for (let b = 0; b < nb; b++) if (Number.isFinite(binned[b]) && baseline - binned[b] > depth * 0.5) width++;
      const durationFrac = Math.max(1, width) / nb;
      return { depth: Math.max(depth, 1e-6), durationFrac, binned, baseline };
    }

    function fluxRange() { // robust y-range: 0.2–99.8 percentile of the flux, padded
      const v = Array.from(shown).filter(Number.isFinite).sort((p, q) => p - q);
      const lo = v[Math.floor(v.length * 0.002)] ?? 0.99, hi = v[Math.floor(v.length * 0.998)] ?? 1.01;
      const pad = (hi - lo) * 0.15;
      return [lo - pad, hi + pad];
    }
    function render() {
      rawPlot.o.x.max = nTransitCtl.get();
      const [ylo, yhi] = fluxRange();
      rawPlot.o.y.min = ylo; rawPlot.o.y.max = yhi;
      foldPlot.o.y.min = 1 - (yhi - ylo) * 0.6; foldPlot.o.y.max = 1 + (yhi - ylo) * 0.4;
      rawPlot.draw(() => {
        rawPlot.scatter(lc.t, shown, { size: 1.6, color: pal.series[0], alpha: 0.7 });
        rawPlot.line(lc.t, trend, { color: pal.accent2, width: 1.5, alpha: 0.9 });
        if (revealed) { // mark the true mid-transit times
          for (const p of system.planets) {
            for (let tt = p.t0Days; tt <= rawPlot.o.x.max; tt += p.periodDays) rawPlot.vline(tt, { color: pal.good, dash: [2, 3] });
          }
        }
      });

      let pmax = 0;
      if (scan) for (let i = 0; i < scan.power.length; i++) pmax = Math.max(pmax, scan.power[i]);
      blsPlot.o.y.max = pmax > 0 ? pmax * 1.15 : 1;
      blsPlot.draw(() => {
        if (scan) {
          blsPlot.line(scan.periods, scan.power, { color: pal.accent });
          if (selectedPeriod) blsPlot.vline(selectedPeriod, { color: pal.accent2, label: `${fmt(selectedPeriod, 3)} d` });
        }
      });

      foldPlot.draw(() => {
        if (!selectedPeriod) return;
        const phase = lc.t.map((tt) => { let p = (tt / selectedPeriod!) % 1; if (p > 0.5) p -= 1; return p; });
        foldPlot.scatter(phase, Array.from(det), { size: 1.6, color: pal.series[0], alpha: 0.5 });
        const { depth, durationFrac } = measureFromFold(selectedPeriod);
        const aAU = semiMajorAxisAU(selectedPeriod, system.star.massSun);
        const rpOverRs = Math.sqrt(Math.max(depth, 1e-8));
        const rpEarth = rpOverRs * system.star.radiusSun * Rsun / Rearth;
        const teq = equilibriumTempK(system.star, aAU);
        rMeas.set(`${fmt(rpEarth, 3)} R⊕`);
        aMeas.set(`${fmt(aAU, 3)} AU`);
        pMeas.set(`${fmt(selectedPeriod, 4)} d`);
        teqMeas.set(`${fmt(teq, 4)} K`);
        // overlay fitted trapezoid model
        const dur = durationFrac / 2;
        foldPlot.fn((ph) => 1 - depth * Math.max(0, 1 - Math.min(1, Math.abs(ph) / dur)), { color: pal.accent2, width: 2 });
        if (revealed) {
          const truth = system.planets[0];
          foldPlot.text(`true: P=${fmt(truth.periodDays, 4)} d, Rp=${fmt(truth.radiusEarth, 3)} R⊕`, 6, 14, { color: pal.good });
        }
      });
    }

    // Redraw only when something changed (canvas resizes clear the canvas, so they count too).
    let dirty = true;
    const loop = new Loop(null, () => {
      if (scanning && scan) {
        scan.step(6);
        status.set(`Scanning periods… ${Math.round(scan.progress() * 100)}%`);
        if (scan.done()) {
          scanning = false;
          selectedPeriod = scan.periods[scan.bestIndex()];
          status.set('Done — peak selected. Click another peak to compare, or Reveal answer.');
        }
        dirty = true;
      }
      if (dirty) { dirty = false; render(); }
    }, 1 / 20);
    function redraw() { dirty = true; loop.invalidate(); }
    for (const st of [rawStage, blsStage, foldStage]) st.onResize(redraw);
    onThemeChange(() => { pal = palette(); redraw(); rvRedraw(); });

    // ============================== RADIAL VELOCITY ==============================
    const rvStageWrap = document.createElement('div');
    rvStageWrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    rvView.append(rvStageWrap);
    const rvStage = createStage(rvStageWrap, { aspect: 1.5 });
    const rvLsStage = createStage(rvStageWrap, { aspect: 1.5 });
    const rvPlot = new Plot(rvStage.canvas, { x: { min: 0, max: 45, label: 'phase-folded time (days)' }, y: { min: -20, max: 20, label: 'RV (m/s)' }, title: 'Radial velocity + Keplerian fit' });
    const lsPlot = new Plot(rvLsStage.canvas, { x: { min: 0.5, max: 60, log: true, label: 'trial period (days)' }, y: { min: 0, max: 1, label: 'Lomb-Scargle power' }, title: 'Periodogram' });
    rvStage.onResize((w, h, dpr) => rvPlot.resize(w, h, dpr));
    rvLsStage.onResize((w, h, dpr) => lsPlot.resize(w, h, dpr));

    const rvPanel = new Panel(rvView);
    const mpCtl = rvPanel.slider('Planet mass', { min: 0.5, max: 500, value: 50, log: true, unit: 'M⊕' }, () => regenRV());
    const incCtl = rvPanel.slider('Inclination', { min: 20, max: 90, value: 90, unit: '°' }, () => regenRV());
    const jitterCtl = rvPanel.slider('Jitter (activity + photon noise)', { min: 0.3, max: 8, value: 1.5, log: true, unit: 'm/s' }, () => regenRV());
    const rvRunBtn = rvPanel.button('Run Lomb-Scargle', () => startLS(), true);
    const kReadout = rvPanel.readout('K (semi-amplitude)');
    const kFitReadout = rvPanel.readout('K (fitted)');
    const rvStatus = rvPanel.readout('Status');

    let rvData = generateRV({ system, planetIndex: 0, planetMassEarth: mpCtl.get(), incDeg: incCtl.get(), nPoints: 60, baselineDays: 90, jitterMs: jitterCtl.get(), seed });
    let ls: ReturnType<typeof createLombScargle> | null = null;
    let lsScanning = false;
    let rvSelectedPeriod: number | null = null;

    function regenRV() {
      rvData = generateRV({ system, planetIndex: 0, planetMassEarth: mpCtl.get(), incDeg: incCtl.get(), nPoints: 60, baselineDays: 90, jitterMs: jitterCtl.get(), seed });
      ls = null; rvSelectedPeriod = null;
      kReadout.set(`${fmt(rvData.K, 3)} m/s (true)`);
      rvRedraw();
    }
    function startLS() {
      ls = createLombScargle(rvData.t, rvData.rv, 0.5, 60, 1200);
      lsScanning = true;
      rvStatus.set('Scanning…');
    }
    rvLsStage.canvas.addEventListener('click', (ev) => {
      if (!ls) return;
      const r = rvLsStage.canvas.getBoundingClientRect();
      const P = lsPlot.dx(ev.clientX - r.left);
      let best = 0, bestD = Infinity;
      for (let i = 0; i < ls.periods.length; i++) { const d = Math.abs(Math.log(ls.periods[i] / P)); if (d < bestD) { bestD = d; best = i; } }
      rvSelectedPeriod = ls.periods[best];
      rvRedraw();
    });

    let kFit = 0;
    function renderRV() {
      const per = rvSelectedPeriod ?? 30;
      let vmax = 5;
      for (const v of rvData.rv) vmax = Math.max(vmax, Math.abs(v));
      rvPlot.o.x.max = per;
      rvPlot.o.y.min = -1.25 * vmax; rvPlot.o.y.max = 1.25 * vmax;
      rvPlot.draw(() => {
        const phase = rvData.t.map((tt) => ((tt % per) + per) % per);
        rvPlot.scatter(phase, rvData.rv, { size: 3, color: pal.series[0] });
        if (rvSelectedPeriod) {
          // Least-squares sinusoid (circular Keplerian) at the chosen period: rv ≈ a sin ωt + b cos ωt + c.
          const w = (2 * Math.PI) / rvSelectedPeriod;
          let Sss = 0, Scc = 0, Ssc = 0, Ss = 0, Sc = 0, Sys = 0, Syc = 0, Sy = 0;
          const n = rvData.t.length;
          rvData.t.forEach((tt, i) => {
            const si = Math.sin(w * tt), ci = Math.cos(w * tt), y = rvData.rv[i];
            Sss += si * si; Scc += ci * ci; Ssc += si * ci; Ss += si; Sc += ci; Sys += y * si; Syc += y * ci; Sy += y;
          });
          const M = [[Sss, Ssc, Ss], [Ssc, Scc, Sc], [Ss, Sc, n]], rhs = [Sys, Syc, Sy];
          const det3 = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
          const D = det3(M);
          const col = (k: number) => M.map((row, r) => row.map((v, c) => (c === k ? rhs[r] : v)));
          const [a, b, c] = D ? [det3(col(0)) / D, det3(col(1)) / D, det3(col(2)) / D] : [0, 0, 0];
          rvPlot.fn((tt) => a * Math.sin(w * tt) + b * Math.cos(w * tt) + c, { color: pal.accent2, width: 2 });
          kFit = Math.hypot(a, b);
        }
        kFitReadout.set(rvSelectedPeriod ? `${fmt(kFit, 3)} m/s at P = ${fmt(rvSelectedPeriod, 3)} d` : '—');
      });
      lsPlot.draw(() => {
        if (ls) {
          lsPlot.line(ls.periods, ls.power, { color: pal.accent });
          if (rvSelectedPeriod) lsPlot.vline(rvSelectedPeriod, { color: pal.accent2, label: `${fmt(rvSelectedPeriod, 3)} d` });
        }
      });
    }

    let rvDirty = true;
    const rvLoop = new Loop(null, () => {
      if (lsScanning && ls) {
        ls.step(6);
        rvStatus.set(`Scanning… ${Math.round(ls.progress() * 100)}%`);
        if (ls.done()) { lsScanning = false; rvSelectedPeriod = ls.periods[ls.bestIndex()]; rvStatus.set('Done — peak selected.'); }
        rvDirty = true;
      }
      if (rvDirty) { rvDirty = false; renderRV(); }
    }, 1 / 20);
    function rvRedraw() { rvDirty = true; rvLoop.invalidate(); }
    for (const st of [rvStage, rvLsStage]) st.onResize(rvRedraw);

    regen();
    regenRV();

    onDestroy(() => { loop.destroy(); rvLoop.destroy(); });
    return {
      setVisible(v) { loop.setVisible(v); rvLoop.setVisible(v); },
      destroy() { loop.destroy(); rvLoop.destroy(); },
    };
  },
});
