// Chapter 4 flagship: interactive Planck-spectrum explorer.
// B_λ(T) over 8+ decades of wavelength, a true-colour rainbow under the visible band, Wien's
// peak, Rayleigh–Jeans/Wien overlays, pinnable comparison curves, a perceived-colour swatch and
// a glowing star disk rendered from the same physics.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { planckLambda, wienPeak, blackbodyRGB, blackbodyCSS, wavelengthRGB } from '../lib/physics/blackbody';
import { rayleighJeansLambda, wienApproxLambda, totalFlux, visibleFraction, colorIndexBV, PRESETS } from './light/spectrum';

const NM = 1e-9;
const VIS_LO = 380, VIS_HI = 780; // nm

const SKY = '#05060c', SKY_TEXT = 'rgba(220,226,240,0.75)';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : 'minmax(0,1.6fr) minmax(0,1fr)'};gap:0`;
    host.append(wrap);

    const plotStage = createStage(wrap, { aspect: 16 / 11 });
    const starCol = document.createElement('div');
    starCol.style.cssText = 'display:flex;flex-direction:column;';
    wrap.append(starCol);
    plotStage.el.style[narrow ? 'borderBottom' : 'borderRight'] = '1px solid var(--rule)';
    const starStage = createStage(starCol, { aspect: 1 });

    const swatch = document.createElement('div');
    swatch.style.cssText = 'height:34px;margin:8px 10px 4px;border-radius:6px;border:1px solid var(--rule)';
    starCol.append(swatch);

    const readoutBox = document.createElement('div');
    readoutBox.style.cssText = 'padding:2px 10px 8px;font-family:var(--font-ui);font-size:12.5px;line-height:1.65;color:var(--fg-muted)';
    starCol.append(readoutBox);

    let T = 5772;
    let logX = true;
    let showRJ = false;
    let showWien = false;
    let showVisible = true;
    const pins: { T: number; color: string }[] = [];

    function xRange(): [number, number] {
      if (logX) return [1, 1e8]; // nm: 1 nm .. 100 mm
      const peak = wienPeak(T) / NM;
      return [Math.max(1, peak * 0.05), peak * 6];
    }
    function yRange(Tref: number): [number, number] {
      const peakB = planckLambda(wienPeak(Tref), Tref);
      return logX ? [peakB * 1e-9, peakB * 3] : [0, peakB * 1.15];
    }

    const [x0, x1] = xRange();
    const plot = new Plot(plotStage.canvas, {
      x: { min: x0, max: x1, log: logX, label: 'wavelength λ (nm)' },
      y: { min: 1e-2, max: 1, log: logX, label: 'Bλ (W sr⁻¹ m⁻³)' },
      title: 'Planck spectrum',
    });

    function rescale() {
      const [xa, xb] = xRange();
      plot.o.x.min = xa; plot.o.x.max = xb; plot.o.x.log = logX;
      const [ya, yb] = yRange(T);
      plot.o.y.min = ya; plot.o.y.max = yb; plot.o.y.log = logX;
    }
    rescale();

    function render() {
      // --- star disk ---
      {
        const { width: W, height: H, dpr } = starStage;
        const ctx = starStage.canvas.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // the star is drawn in its physical colour, so it always sits on a night sky (both themes)
        ctx.fillStyle = SKY; ctx.fillRect(0, 0, W, H);
        const [r, g, b] = blackbodyRGB(T);
        const rgb = `${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0}`;
        const cx = W / 2, cy = H / 2;
        const relL = (T / 5772) ** 4; // luminosity relative to a same-radius solar-temperature star
        const glow = Math.max(0, Math.min(1, (Math.log10(relL) + 4) / 8)); // -4..+4 decades -> 0..1
        const R = Math.min(W, H) * 0.16;
        const haloR = R * (1.6 + 2.4 * glow);
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
        halo.addColorStop(0, `rgba(${rgb},${0.5 * glow + 0.08})`);
        halo.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill();
        const disk = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        disk.addColorStop(0, '#fff');
        disk.addColorStop(0.25, `rgba(${rgb},1)`);
        disk.addColorStop(1, `rgba(${rgb},0.85)`);
        ctx.fillStyle = disk;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = SKY_TEXT;
        ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`L / L☉ (same R) ≈ ${fmt(relL, 3)}×`, cx, H - 10);
      }
      swatch.style.background = blackbodyCSS(T);

      // --- readouts ---
      const lamPeak = wienPeak(T) / NM;
      const flux = totalFlux(T);
      const vis = visibleFraction(T) * 100;
      const bv = colorIndexBV(T);
      const bvText = vis < 1e-6 ? 'n/a (no visible emission)' : `≈ ${fmt(Math.max(-1, Math.min(bv, 50)), 2)}`;
      readoutBox.innerHTML = `
        <div><b>λ<sub>peak</sub></b> = ${lamPeak < 1000 ? fmt(lamPeak, 3) + ' nm' : fmt(lamPeak / 1000, 3) + ' μm'}</div>
        <div><b>Flux</b> σT⁴ = ${fmt(flux, 3)} W/m²</div>
        <div><b>Visible</b> fraction ≈ ${vis < 1e-4 ? '&lt;0.0001' : fmt(vis, 3)}%</div>
        <div><b>Colour index</b> (proxy B−V) ${bvText}</div>
      `;

      // --- plot ---
      plot.draw(() => {
        const { ctx } = plot;
        // visible band rainbow, drawn as a thin strip just above the x-axis
        if (showVisible) {
          const yTop = plot.m.t + plot.ph;
          const stripH = 10;
          for (let nm = VIS_LO; nm < VIS_HI; nm += 2) {
            const [r, g, b] = wavelengthRGB(nm);
            ctx.fillStyle = `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
            const xA = plot.px(nm), xB = plot.px(nm + 2);
            ctx.fillRect(xA, yTop - stripH, Math.max(1, xB - xA), stripH);
          }
        }
        // pinned comparison curves
        for (const p of pins) {
          plot.fn((nmv) => planckLambda(nmv * NM, p.T), { color: p.color, alpha: 0.7, width: 1.4 });
        }
        // approximations
        if (showRJ) plot.fn((nmv) => rayleighJeansLambda(nmv * NM, T), { color: pal.bad, dash: [2, 3], width: 1.3 });
        if (showWien) plot.fn((nmv) => wienApproxLambda(nmv * NM, T), { color: pal.accent2, dash: [6, 3], width: 1.3 });
        // main curve
        plot.fn((nmv) => planckLambda(nmv * NM, T), { color: pal.accent, width: 2.2 });
        // Wien peak marker
        plot.vline(lamPeak, { color: pal.fg, label: 'λ_peak' });
      });
    }

    const loop = new Loop(null, render, 1 / 30);
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    starStage.onResize(() => loop.invalidate());

    // --- controls ---
    const panel = new Panel(host);
    panel.select(
      'Preset',
      PRESETS.map((p) => ({ value: p.label, label: p.label })),
      'Sun',
      (label) => {
        const p = PRESETS.find((q) => q.label === label)!;
        T = p.T;
        tSlider.set(T);
        rescale(); loop.invalidate();
      },
    );
    const tSlider = panel.slider(
      'Temperature',
      { min: 3, max: 1e6, value: T, log: true, unit: 'K', format: (v) => fmt(v, 4) },
      (v) => { T = v; rescale(); loop.invalidate(); },
    );
    panel.toggle('Linear scale', false, (v) => { logX = !v; rescale(); loop.invalidate(); });
    panel.toggle('Visible band', true, (v) => { showVisible = v; loop.invalidate(); });
    panel.toggle('Rayleigh–Jeans approx.', false, (v) => { showRJ = v; loop.invalidate(); });
    panel.toggle('Wien approx.', false, (v) => { showWien = v; loop.invalidate(); });
    panel.button('Pin curve', () => {
      if (pins.length >= 4) pins.shift();
      pins.push({ T, color: pal.series[pins.length % pal.series.length] });
      loop.invalidate();
    });
    panel.button('Clear pins', () => { pins.length = 0; loop.invalidate(); });

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
