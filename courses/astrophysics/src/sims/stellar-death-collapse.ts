// Flagship: a stylised core-collapse supernova. This is NOT a multi-dimensional radiation-hydrodynamics
// calculation — real core-collapse sims (FORNAX, CHIMERA, ...) need thousands of CPU-hours. It is a
// phenomenological toy, tuned to reproduce the qualitative *sequence* and rough *timescales* that those
// simulations and observations (SN 1987A, Cas A) establish:
//
//   iron core collapse (~0.1 s) -> bounce -> stalled shock (~0.1-0.5 s, SASI sloshing) ->
//   neutrino-driven revival (or failure -> black hole) -> shock breakout through the onion layers
//   (H / He / C-O / Ne-Mg / Si / Fe), hours to days later, with Rayleigh-Taylor fingering at composition
//   interfaces.
//
// See the <Hood> in the chapter text for the model and why it runs on the CPU rather than the GPU.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange, type Palette } from '../lib/ui/theme';

type Phase = 'collapse' | 'stalled' | 'exploding' | 'failed';

interface Layer { name: string; colorOf: (pal: Palette) => string; outerKm: number }

// Onion-shell boundaries scale weakly with progenitor mass; numbers are illustrative pre-supernova
// structure (real profiles come from stellar-evolution codes like MESA/KEPLER — Chapter 15).
function layersForMass(Mprog: number): Layer[] {
  const s = (Mprog / 15) ** 0.25;
  return [
    { name: 'Fe core', colorOf: (p) => p.muted, outerKm: 3000 * s },
    { name: 'Si', colorOf: (p) => p.series[4], outerKm: 1.2e4 * s },
    { name: 'Ne/Mg/O', colorOf: (p) => p.series[2], outerKm: 8e4 * s },
    { name: 'C/O', colorOf: (p) => p.series[3], outerKm: 6e5 * (Mprog / 15) ** 0.4 },
    { name: 'He', colorOf: (p) => p.accent2, outerKm: 3e6 * (Mprog / 15) ** 0.5 },
    { name: 'H envelope', colorOf: (p) => p.accent, outerKm: 3.2e8 * (Mprog / 15) ** 0.3 },
  ];
}

function neutrinoLuminosity(tPB: number): number {
  // Deleptonization burst at bounce (~ms) plus an accretion/cooling tail over ~0.5-1 s.
  const burst = 3.2 * Math.exp(-tPB / 0.006);
  const tail = 1.0 * Math.exp(-tPB / 0.55);
  return burst + tail;
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);';
    host.append(wrap);
    const mainStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 / 1.05 });
    mainStage.el.style.borderRight = '1px solid var(--rule)';
    // side by side on wide screens, stacked on phones
    const stackRO = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1.35fr) minmax(0,1fr)';
      mainStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      mainStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    stackRO.observe(wrap);
    onDestroy(() => stackRO.disconnect());
    const ctx = mainStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: -0.15, max: 0.65, label: 't since bounce (s, linear near bounce)' },
      y: { min: 0.01, max: 5, log: true, label: 'ν luminosity (rel.)' },
      title: 'Neutrino luminosity',
    });

    // --- parameters ---
    let Mprog = 15; // Msun
    let heating = 1.05; // multiplies the neutrino heating efficiency; >~1 revives the shock
    let layers = layersForMass(Mprog);

    // --- state ---
    let phase: Phase = 'collapse';
    let tGlobal = -0.15; // displayed clock, seconds; negative = before bounce
    let tPB = 0; // seconds since bounce (physical)
    let warp = 0.05; // physical-seconds-per-story-second (the "non-linear clock")
    let rCoreKm = 3000;
    let rShockKm = 40;
    let explodeStart = 0; // story-time (real seconds) at which the shock began to run away
    let storyClock = 0; // real seconds elapsed since mount/reset
    let sasiPh1 = 0, sasiPh2 = Math.PI / 3, sasiAmp = 0;
    let rtAmp = 0;
    const fingerModes = Array.from({ length: 6 }, (_, i) => ({ k: 3 + i, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6 }));
    const nuHist = new Series(2000);
    let outcome = '';

    function reset() {
      layers = layersForMass(Mprog);
      phase = 'collapse';
      tGlobal = -0.15; tPB = 0; warp = 0.05;
      rCoreKm = 3000; rShockKm = 40;
      storyClock = 0; explodeStart = 0;
      sasiPh1 = 0; sasiPh2 = Math.PI / 3; sasiAmp = 0; rtAmp = 0;
      nuHist.clear();
      outcome = '';
    }
    reset();

    function clockLabel(): string {
      if (phase === 'collapse') return `t = ${fmt(tGlobal * 1000, 3)} ms  (collapsing)`;
      const s = tPB;
      if (s < 2) return `t = ${fmt(s * 1000, 4)} ms post-bounce`;
      if (s < 3600) return `t = ${fmt(s, 4)} s post-bounce`;
      if (s < 3 * 3600 * 24) return `t = ${fmt(s / 3600, 3)} hours post-bounce`;
      return `t = ${fmt(s / 86400, 3)} days post-bounce`;
    }

    function step(dtStory: number) {
      storyClock += dtStory;
      const HEAT_WINDOW = 0.5; // seconds of physical stall time before we decide the outcome
      const THRESH = 1.0 + 0.006 * (Mprog - 12); // slightly harder to revive for heavier cores

      if (phase === 'collapse') {
        const dtPhys = dtStory * warp;
        tGlobal += dtPhys;
        const frac = Math.min(1, (tGlobal + 0.15) / 0.15);
        rCoreKm = 3000 * Math.pow(30 / 3000, frac);
        if (frac >= 1) { phase = 'stalled'; tPB = 0; rShockKm = 45; rCoreKm = 30; }
        return;
      }

      const dtPhys = dtStory * warp;
      tPB += dtPhys;
      tGlobal = tPB;
      const Lnu = neutrinoLuminosity(tPB);
      nuHist.push(tPB, Lnu);

      if (phase === 'stalled') {
        sasiAmp = Math.min(0.16, sasiAmp + dtStory * 0.03);
        sasiPh1 += dtStory * 2.1;
        sasiPh2 += dtStory * 1.3;
        const rEq = 150 * (1 + 0.15 * Math.sin(sasiPh1 * 1.7));
        rShockKm += (rEq - rShockKm) * Math.min(1, dtStory * 4);
        rCoreKm = 32 + 6 * Math.max(0, heating - 1); // accreting mass slowly puffs/heats the PNS surface a touch
        if (tPB >= HEAT_WINDOW) {
          if (heating >= THRESH) { phase = 'exploding'; explodeStart = storyClock; outcome = 'Shock revived — neutrino heating wins. A supernova is born.'; }
          else { phase = 'failed'; outcome = 'Shock never revives — the envelope keeps falling in. No supernova: a black hole grows in silence.'; }
        }
        return;
      }

      if (phase === 'exploding') {
        const tauExplode = storyClock - explodeStart;
        // Non-linear clock: ramp the physical-time-per-real-second by ~5 orders of magnitude so the
        // shock can cross the whole star (km -> ~10^8-10^9 km) within a comfortable viewing time.
        warp = 0.05 * Math.pow(1 / 0.05 * 4e4, Math.min(1, tauExplode / 14));
        const vKmS = 3500 * Math.pow(Math.max(rShockKm, 45) / 150, 0.4) * Math.min(2.2, 1 + heating - 1);
        rShockKm += vKmS * dtPhys;
        rtAmp = Math.min(0.07, rtAmp + dtStory * 0.01);
        sasiAmp = Math.max(0, sasiAmp - dtStory * 0.05);
        const Rstar = layers[layers.length - 1].outerKm;
        if (rShockKm >= Rstar * 1.02) rShockKm = Rstar * 1.02; // breakout: hold at the surface
        return;
      }

      if (phase === 'failed') {
        rShockKm = Math.max(rCoreKm * 1.1, rShockKm - 40 * dtPhys);
        rCoreKm = Math.min(rCoreKm + dtPhys * 2, 90); // "settling" toward black-hole formation, visually
        warp = Math.min(warp * (1 + dtStory * 0.05), 50);
      }
    }

    function boundaryFactor(theta: number, t: number): number {
      let f = 1;
      if (phase === 'stalled') f += sasiAmp * (0.7 * Math.sin(theta + sasiPh1) + 0.3 * Math.sin(2 * theta + sasiPh2));
      if (rtAmp > 0) {
        let s = 0;
        for (const m of fingerModes) s += Math.sin(m.k * theta + m.phase + m.speed * t);
        f += (rtAmp / fingerModes.length) * s;
      }
      return f;
    }

    // --- rendering ---
    const RMIN_KM = 8;
    function rPix(rKm: number, innerR: number, outerR: number, rMaxKm: number) {
      const lo = Math.log10(RMIN_KM), hi = Math.log10(rMaxKm);
      const u = (Math.log10(Math.max(rKm, RMIN_KM)) - lo) / (hi - lo);
      return innerR + Math.max(0, Math.min(1, u)) * (outerR - innerR);
    }

    function render() {
      const { width: W, height: H, dpr } = mainStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, outerR = Math.min(W, H) * 0.47, innerR = 3;
      const Rstar = layers[layers.length - 1].outerKm;

      // composition rings, dimmed once swept by the shock (crude "already exploded through here" cue)
      let prev = 0;
      for (const layer of layers) {
        const r0 = rPix(prev, innerR, outerR, Rstar), r1 = rPix(layer.outerKm, innerR, outerR, Rstar);
        const swept = rShockKm > layer.outerKm && phase !== 'collapse' && phase !== 'stalled';
        const col = layer.colorOf(pal);
        ctx.beginPath();
        ctx.arc(cx, cy, r1, 0, Math.PI * 2);
        ctx.arc(cx, cy, r0, 0, Math.PI * 2, true);
        ctx.fillStyle = col;
        ctx.globalAlpha = swept ? 0.85 : 0.32;
        ctx.fill('evenodd');
        ctx.globalAlpha = 1;
        prev = layer.outerKm;
      }

      // shock front / ejecta boundary (perturbed circle)
      if (phase !== 'collapse') {
        ctx.beginPath();
        const N = 180;
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * Math.PI * 2;
          const rk = rShockKm * boundaryFactor(th, storyClock);
          const rp = rPix(rk, innerR, outerR, Rstar);
          const x = cx + rp * Math.cos(th), y = cy + rp * Math.sin(th);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = phase === 'failed' ? pal.muted : pal.bad;
        ctx.lineWidth = 2.25;
        ctx.stroke();
      }

      // proto-neutron star / black hole at the centre
      const pnsPix = Math.max(2, rPix(rCoreKm, innerR, outerR, Rstar) * 0.4);
      if (phase === 'failed' && rCoreKm > 60) {
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx, cy, pnsPix, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1; ctx.stroke();
      } else {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pnsPix * 2.4);
        g.addColorStop(0, '#eaf6ff'); g.addColorStop(0.4, pal.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, pnsPix * 2.4, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = pal.fg;
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(clockLabel(), 12, 20);
      ctx.fillStyle = pal.muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      const phaseLabel = { collapse: 'iron core collapsing', stalled: 'shock stalled — SASI sloshing', exploding: 'shock revived — blasting through the star', failed: 'shock failed — forming a black hole' }[phase];
      ctx.fillText(phaseLabel, 12, 36);
      if (outcome) {
        ctx.fillStyle = phase === 'failed' ? pal.bad : pal.good;
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillText(outcome, 12, H - 14, W - 24);
      }
      // legend
      let ly = H - 14 - (outcome ? 18 : 0) - layers.length * 15;
      ctx.font = '10.5px Inter, system-ui, sans-serif';
      const legend = layers.map((layer) => `${layer.name} (R ≈ ${fmt(layer.outerKm, 2)} km)`);
      const lx = W - 8 - 14 - Math.max(...legend.map((t) => ctx.measureText(t).width));
      layers.forEach((layer, i) => {
        ctx.fillStyle = layer.colorOf(pal);
        ctx.fillRect(lx, ly, 10, 10);
        ctx.fillStyle = pal.muted;
        ctx.fillText(legend[i], lx + 14, ly + 9);
        ly += 15;
      });

      plot.draw(() => {
        const [xs, ys] = nuHist.linear();
        plot.line(xs, ys, { color: pal.series[1] });
        if (phase !== 'collapse') plot.vline(tPB, { color: pal.fg, label: 'now' });
        plot.vline(0.5, { color: pal.muted, dash: [2, 3], label: 'decision' });
      });
    }

    const loop = new Loop(step, render, 1 / 120);
    mainStage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Restart', () => { reset(); loop.invalidate(); });
    panel.slider('Progenitor mass', { min: 9, max: 30, value: Mprog, unit: 'M☉', step: 0.5 }, (v) => { Mprog = v; reset(); loop.invalidate(); });
    panel.slider('Neutrino heating efficiency', { min: 0.7, max: 1.6, value: heating, step: 0.01 }, (v) => { heating = v; });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
