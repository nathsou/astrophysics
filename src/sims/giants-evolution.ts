// Chapter 15 flagship: "the life of a star, animated". Pick a mass, scrub or play through
// evolution, and watch three synchronised views: the HR diagram track, a log-zoomed
// rendered star (blackbody colour, pulsation, PN shell / SN flash), and a schematic
// cross-section of composition layers and burning shells (Kippenhahn-like, not to scale).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';
import { stateAt, totalAge, phaseLabel, hrCurve, FLASH_THRESHOLD_MSUN, type PhaseId } from './giants/tracks';

const AU_PER_RSUN = 6.957e8 / 1.495978707e11;

const PRESETS = [
  { label: '1 M☉ (Sun)', mass: 1 },
  { label: '2 M☉', mass: 2 },
  { label: '5 M☉', mass: 5 },
  { label: '15 M☉', mass: 15 },
  { label: '25 M☉', mass: 25 },
];

// Onion-shell composition, roughly keyed to phase + core mass, for the cross-section panel.
// Each layer is [name, colour-index, outer-radius-fraction]. Purely schematic.
function layersFor(phase: PhaseId, mass: number, mcore: number): { name: string; frac: number; kind: 'env' | 'he' | 'co' | 'one' | 'si' | 'fe' | 'burn' }[] {
  const massive = mass >= 8; // roughly the >8 Msun onion-building family
  if (phase === 'ms') return [{ name: 'Core: burning H → He', frac: 0.12, kind: 'burn' }, { name: 'H envelope', frac: 1, kind: 'env' }];
  if (phase === 'subgiant') return [{ name: 'Inert He core', frac: 0.1, kind: 'he' }, { name: 'H-burning shell', frac: 0.14, kind: 'burn' }, { name: 'H envelope', frac: 1, kind: 'env' }];
  if (phase === 'rgb' || phase === 'flash')
    return [{ name: mass < FLASH_THRESHOLD_MSUN ? 'Degenerate He core' : 'Hot He core', frac: 0.05, kind: 'he' }, { name: 'H-burning shell', frac: 0.075, kind: 'burn' }, { name: 'Convective H envelope', frac: 1, kind: 'env' }];
  if (phase === 'hb')
    return [{ name: 'Core: burning He → C, O', frac: 0.08, kind: 'burn' }, { name: 'He layer', frac: 0.11, kind: 'he' }, { name: 'H-burning shell', frac: 0.14, kind: 'burn' }, { name: 'H envelope', frac: 1, kind: 'env' }];
  if (phase === 'agb') {
    if (!massive)
      return [
        { name: 'C/O core', frac: 0.03, kind: 'co' },
        { name: 'He-burning shell', frac: 0.05, kind: 'burn' },
        { name: 'He layer', frac: 0.065, kind: 'he' },
        { name: 'H-burning shell', frac: 0.08, kind: 'burn' },
        { name: 'Convective envelope (3rd dredge-up)', frac: 1, kind: 'env' },
      ];
    return [
      { name: 'Fe core', frac: 0.01, kind: 'fe' },
      { name: 'Si/S shell', frac: 0.02, kind: 'si' },
      { name: 'O shell', frac: 0.04, kind: 'one' },
      { name: 'Ne/O shell', frac: 0.07, kind: 'one' },
      { name: 'C/O shell', frac: 0.14, kind: 'co' },
      { name: 'He shell', frac: 0.3, kind: 'he' },
      { name: 'H envelope', frac: 1, kind: 'env' },
    ];
  }
  // final
  if (!massive) return [{ name: `WD (${fmt(mcore, 2)} M☉, degenerate C/O)`, frac: 1, kind: 'co' }];
  return [{ name: `Remnant (${fmt(mcore, 2)} M☉)`, frac: 1, kind: 'fe' }];
}

const LAYER_COLOR: Record<string, (pal: ReturnType<typeof palette>) => string> = {
  env: (p) => p.series[0],
  he: (p) => p.series[1],
  co: (p) => p.series[2],
  one: (p) => p.series[3],
  si: (p) => p.series[4] ?? p.accent2,
  fe: (p) => p.muted,
  burn: (p) => p.bad,
};

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;';
    host.append(wrap);
    const ro = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560; // phones: stack the HR diagram above the star
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)';
      hrStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
    });
    ro.observe(wrap);
    onDestroy(() => ro.disconnect());

    const hrStage = createStage(wrap, { aspect: 1 });
    const starStage = createStage(wrap, { aspect: 1 });
    starStage.el.style.background = '#05060a'; // a window onto space in both themes: stars glow
    hrStage.el.style.borderRight = '1px solid var(--rule)';
    const crossWrap = document.createElement('div');
    crossWrap.style.cssText = 'grid-column:1 / -1;border-top:1px solid var(--rule);';
    wrap.append(crossWrap);
    const crossStage = createStage(crossWrap, { aspect: host.clientWidth < 560 ? 1 / 1.1 : 1 / 0.3 }); // taller on phones, for the legend

    const hrCtx = hrStage.canvas.getContext('2d')!;
    const starCtx = starStage.canvas.getContext('2d')!;
    const crossCtx = crossStage.canvas.getContext('2d')!;

    const hrPlot = new Plot(hrStage.canvas, {
      // reversed axis (hot on the left): explicit ticks
      x: { min: 5.2, max: 3.3, label: 'log T_eff (K), hot → cool', ticks: [5.0, 4.6, 4.2, 3.8, 3.4], format: (v) => v.toFixed(1) },
      y: { min: -3.5, max: 6.8, label: 'log L / L☉' },
      title: 'HR diagram track',
    });

    let mass = 1;
    let s = 0; // phase-weighted scrubber, 0..1
    let playing = false;
    let playSpeed = 0.05; // slider units per second

    function draw() {
      // ---- HR diagram ----
      hrCtx.setTransform(hrStage.dpr, 0, 0, hrStage.dpr, 0, 0);
      hrPlot.resize(hrStage.width, hrStage.height, hrStage.dpr);
      const curve = hrCurve(mass);
      hrPlot.draw(() => {
        hrPlot.line(curve.map((p) => p.logT), curve.map((p) => p.logL), { color: pal.muted, width: 1.4, alpha: 0.7 });
        const st = stateAt(mass, s);
        const x = hrPlot.px(st.logT), y = hrPlot.py(st.logL);
        hrCtx.fillStyle = pal.accent;
        hrCtx.beginPath(); hrCtx.arc(x, y, 5.5, 0, Math.PI * 2); hrCtx.fill();
        hrCtx.strokeStyle = pal.fg; hrCtx.lineWidth = 1.5; hrCtx.stroke();
        // Sun marker for reference
        hrCtx.fillStyle = pal.muted;
        const sx = hrPlot.px(3.762), sy = hrPlot.py(0);
        hrCtx.beginPath(); hrCtx.arc(sx, sy, 3, 0, Math.PI * 2); hrCtx.fill();
        hrPlot.text('Sun today', sx - 8, sy + 4, { color: pal.muted, size: 10, align: 'right' });
        if (st.phase === 'final' && mass >= 8) hrPlot.text('core collapse: off the diagram', hrPlot.m.l + 8, hrPlot.m.t + 14, { color: pal.bad, size: 11 });
      });

      // ---- rendered star ----
      const st = stateAt(mass, s);
      const { width: W, height: H, dpr } = starStage;
      starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starCtx.clearRect(0, 0, W, H);
      const Teff = 10 ** st.logT;
      const col = blackbodyCSS(Teff, 1);
      const colFade = blackbodyCSS(Teff, 0);
      // log-zoomed apparent radius: map log10(R) in [-2, 3.2] to pixel radius
      const logR = Math.log10(Math.max(st.R, 1e-6));
      const t = (logR + 2) / 5.2;
      let pxR = 6 + Math.max(0, Math.min(1, t)) * (Math.min(W, H) * 0.42);
      const cx = W / 2, cy = H / 2;

      const isFinalLow = st.phase === 'final' && mass < 8;
      const isFinalHigh = st.phase === 'final' && mass >= 8;
      // pulsation for AGB / flash-adjacent (instability-strip-like) phases
      const pulse = (st.phase === 'agb' || st.phase === 'hb') ? 1 + 0.06 * Math.sin(perfNow() * (st.phase === 'agb' ? 2.2 : 1.1)) : 1;
      pxR *= pulse;

      if (isFinalHigh) {
        // supernova flash
        const flashT = st.phaseFrac;
        const flashR = 8 + flashT * Math.min(W, H) * 0.55;
        const g = starCtx.createRadialGradient(cx, cy, 0, cx, cy, flashR);
        const a = Math.max(0, 1 - flashT);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.4, `rgba(255,220,150,${a * 0.7})`);
        g.addColorStop(1, 'rgba(255,180,120,0)');
        starCtx.fillStyle = g;
        starCtx.beginPath(); starCtx.arc(cx, cy, flashR, 0, Math.PI * 2); starCtx.fill();
        starCtx.fillStyle = "#9a988f";
        starCtx.beginPath(); starCtx.arc(cx, cy, 3, 0, Math.PI * 2); starCtx.fill();
      } else if (isFinalLow) {
        // expanding planetary nebula shell around a small hot WD
        const shellR = 20 + st.phaseFrac * Math.min(W, H) * 0.42;
        starCtx.strokeStyle = "#7cb7ff";
        starCtx.globalAlpha = Math.max(0.15, 0.6 - st.phaseFrac * 0.4);
        starCtx.lineWidth = 6;
        starCtx.beginPath(); starCtx.ellipse(cx, cy, shellR, shellR * 0.72, 0, 0, Math.PI * 2); starCtx.stroke();
        starCtx.globalAlpha = 1;
        const g = starCtx.createRadialGradient(cx, cy, 0, cx, cy, 6);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
        starCtx.fillStyle = g;
        starCtx.beginPath(); starCtx.arc(cx, cy, 6, 0, Math.PI * 2); starCtx.fill();
      } else {
        const g = starCtx.createRadialGradient(cx, cy, 0, cx, cy, pxR);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.15, col);
        g.addColorStop(1, colFade);
        starCtx.fillStyle = g;
        starCtx.beginPath(); starCtx.arc(cx, cy, Math.max(2, pxR), 0, Math.PI * 2); starCtx.fill();
        starCtx.strokeStyle = 'rgba(255,255,255,0.25)'; starCtx.lineWidth = 1;
        starCtx.beginPath(); starCtx.arc(cx, cy, Math.max(2, pxR), 0, Math.PI * 2); starCtx.stroke();
      }
      starCtx.fillStyle = '#b9b6ae';
      starCtx.font = '12px Inter, system-ui, sans-serif';
      starCtx.fillText(`T_eff ≈ ${fmt(Teff, 3)} K`, 10, H - 12);
      starCtx.fillText(`R ≈ ${fmt(st.R, 3)} R☉`, 10, H - 28);

      // ---- cross-section ----
      const { width: CW, height: CH, dpr: cdpr } = crossStage;
      crossCtx.setTransform(cdpr, 0, 0, cdpr, 0, 0);
      crossCtx.clearRect(0, 0, CW, CH);
      const layers = layersFor(st.phase, mass, st.Mcore);
      // A cutaway: concentric half-discs, outermost first so the inner layers paint on top.
      // Radii are stretched (r ∝ frac^0.45) so thin inner shells stay visible; not to scale.
      const narrow = CW < 520; // phones: legend below the cutaway instead of beside it
      const legendW = Math.min(300, CW * 0.42);
      const Rmax = narrow ? Math.min(CW / 2 - 20, CH * 0.36) : Math.max(20, Math.min(CH - 40, (CW - legendW - 40) / 2));
      const ccx = narrow ? CW / 2 : 20 + Rmax, ccy = narrow ? Rmax + 34 : CH - 14;
      for (let i = layers.length - 1; i >= 0; i--) {
        const r = Rmax * Math.pow(layers[i].frac, 0.45);
        crossCtx.fillStyle = LAYER_COLOR[layers[i].kind](pal);
        crossCtx.beginPath(); crossCtx.moveTo(ccx - r, ccy); crossCtx.arc(ccx, ccy, r, Math.PI, 2 * Math.PI); crossCtx.closePath(); crossCtx.fill();
        crossCtx.strokeStyle = pal.bg; crossCtx.lineWidth = 1; crossCtx.stroke();
      }
      crossCtx.strokeStyle = pal.grid; crossCtx.lineWidth = 1;
      crossCtx.beginPath(); crossCtx.moveTo(ccx - Rmax - 6, ccy); crossCtx.lineTo(ccx + Rmax + 6, ccy); crossCtx.stroke();
      // legend, innermost first, to the right of the cutaway
      crossCtx.font = '12px Inter, system-ui, sans-serif';
      crossCtx.textAlign = 'left'; crossCtx.textBaseline = 'middle';
      const lx = narrow ? 14 : ccx + Rmax + 28;
      let ly = narrow ? ccy + 20 : Math.max(24, ccy - layers.length * 20 - 6);
      for (const l of layers) {
        crossCtx.fillStyle = LAYER_COLOR[l.kind](pal);
        crossCtx.fillRect(lx, ly - 6, 12, 12);
        crossCtx.fillStyle = pal.fg;
        crossCtx.fillText(l.name, lx + 18, ly);
        ly += 20;
      }
      crossCtx.fillStyle = pal.muted; crossCtx.textBaseline = 'alphabetic';
      crossCtx.fillText(narrow ? 'Cutaway (not to scale; red = burning)' : 'Cutaway, schematic (layer thicknesses not to scale; red = burning)', 14, 18);

      // readouts
      readAge.set(fmtAge(st.age));
      readPhase.set(phaseLabel(st.phase, mass));
      readL.set(`${fmt(10 ** st.logL, 3)} L☉`);
      readT.set(`${fmt(Teff, 3)} K`);
      readR.set(`${fmt(st.R, 3)} R☉ (${fmt(st.R * AU_PER_RSUN, 3)} AU)`);
      readCore.set(`${fmt(st.Mcore, 3)} M☉`);
    }

    function fmtAge(yr: number): string {
      if (yr < 1e3) return `${fmt(yr, 3)} yr`;
      if (yr < 1e6) return `${fmt(yr / 1e3, 3)} kyr`;
      if (yr < 1e9) return `${fmt(yr / 1e6, 3)} Myr`;
      return `${fmt(yr / 1e9, 3)} Gyr`;
    }

    let t0 = performance.now();
    function perfNow() { return (performance.now() - t0) / 1000; }

    const loop = new Loop((dt) => {
      if (playing) {
        s += playSpeed * dt;
        if (s >= 1) { s = 1; playing = false; playToggle && playToggle(); }
      }
    }, draw, 1 / 30);

    hrStage.onResize(() => loop.invalidate());
    starStage.onResize(() => loop.invalidate());
    crossStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    let playToggle: (() => void) | null = null;
    panel.select('Mass', PRESETS.map((p) => ({ value: String(p.mass), label: p.label })), '1', (v) => { mass = Number(v); massSlider.set(mass); loop.invalidate(); });
    const massSlider = panel.slider('Mass (M☉)', { min: 0.8, max: 40, value: 1, log: true, step: 0.05, unit: 'M☉' }, (v) => { mass = v; loop.invalidate(); });
    const scrub = panel.slider('Evolution (phase-weighted)', { min: 0, max: 1, value: 0, step: 0.001 }, (v) => { s = v; playing = false; loop.invalidate(); });
    const playBtn = panel.button('▶ Play', () => {
      playing = !playing;
      playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    });
    playToggle = () => { playBtn.textContent = '▶ Play'; };
    panel.slider('Speed', { min: 0.005, max: 0.4, value: playSpeed, log: true }, (v) => (playSpeed = v));
    panel.button('Reset', () => { s = 0; playing = false; playBtn.textContent = '▶ Play'; loop.invalidate(); });

    const readAge = panel.readout('Age');
    const readPhase = panel.readout('Phase');
    const readL = panel.readout('L');
    const readT = panel.readout('T_eff');
    const readR = panel.readout('R');
    const readCore = panel.readout('Core mass');

    // keep the scrubber control in sync while playing
    const syncInterval = setInterval(() => { if (playing) scrub.set(s); }, 100);

    loop.invalidate();

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => { loop.destroy(); clearInterval(syncInterval); },
    };
  },
});
