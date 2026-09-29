// Flagship sim: a synthetic stellar spectrum. Planck continuum + a curated set of absorption
// lines whose depths come from the Boltzmann/Saha model in ./spectra/physics.ts, broadened with
// a pseudo-Voigt profile, plus a "rainbow" spectrograph-strip view and a Doppler/redshift slider.
import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { planckLambda, wavelengthRGB } from '../lib/physics/blackbody';
import { c } from '../lib/physics/constants';
import {
  LINES, lineDepth, lineTau, dopplerFWHM_nm, lorentzFWHM_nm, pseudoVoigt, solveElectronDensity,
  spectralSubtype, STAR_PRESETS, SPECIES,
} from './spectra/physics';

const LAM_MIN = 350, LAM_MAX = 900; // nm, plotted band

function continuum(nm: number, T: number): number {
  return planckLambda(nm * 1e-9, T);
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => (pal = palette()));

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    host.append(wrap);

    const stage = createStage(wrap, { aspect: 1000 / 480 });
    const strip = document.createElement('canvas');
    strip.style.width = '100%';
    strip.style.height = '52px';
    strip.style.display = 'block';
    strip.style.borderRadius = '4px';
    strip.style.cursor = 'crosshair';
    wrap.append(strip);

    const tooltip = document.createElement('div');
    Object.assign(tooltip.style, {
      position: 'absolute', pointerEvents: 'none', font: '11px JetBrains Mono, ui-monospace, monospace',
      background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--fg)', borderRadius: '4px',
      padding: '3px 7px', display: 'none', zIndex: '5', whiteSpace: 'nowrap',
    });
    stage.overlay.style.pointerEvents = 'none';
    wrap.style.position = 'relative';
    wrap.append(tooltip);

    const plot = new Plot(stage.canvas, {
      x: { min: LAM_MIN, max: LAM_MAX, label: 'wavelength (nm)' },
      y: { min: 0, max: 1.15, label: 'relative flux' },
    });
    stage.onResize((w, h, dpr) => plot.resize(w, h, dpr));

    const panel = new Panel(wrap);
    const readT = panel.readout('T_eff');
    const readType = panel.readout('Type');
    const readNe = panel.readout('nₑ');

    let T = 5772;
    let vel = 0; // km/s, +away
    let labelsOn = true;

    const tSlider = panel.slider('Temperature', { min: 2500, max: 40000, value: T, log: true, unit: 'K', format: (v) => String(Math.round(v)) }, (v) => {
      T = v; presetSel.set('—'); redraw();
    });
    const vSlider = panel.slider('Velocity', { min: -3000, max: 3000, value: 0, step: 10, unit: 'km/s' }, (v) => {
      vel = v; redraw();
    });
    const presetSel = panel.select(
      'Preset',
      [{ value: '—', label: '— custom —' }, ...STAR_PRESETS.map((p) => ({ value: p.name, label: `${p.name} (${p.label})` }))],
      '—',
      (v) => {
        const p = STAR_PRESETS.find((s) => s.name === v);
        if (p) { T = p.T; tSlider.set(T); redraw(); }
      },
    );
    panel.toggle('Line labels', true, (v) => { labelsOn = v; redraw(); });
    panel.button('Reset velocity', () => { vel = 0; vSlider.set(0); redraw(); });

    function dopplerFactor() { return 1 + (vel * 1000) / c; }

    function computeSpectrum() {
      const ne = solveElectronDensity(T, 1e19);
      const f = dopplerFactor();
      const lines = LINES.map((line) => ({
        line,
        nm: line.nm * f,
        depth: lineDepth(line, T, ne),
        // saturated lines keep growing through their damping wings (equivalent width ∝ √τ):
        // this is what makes A-star Balmer lines so broad
        // molecular bands are blends of thousands of lines: drawn ~15 nm wide
        fwhm: line.category === 'molecule' ? 15 : Math.max(voigtCombined(line, T, ne), 0.4) * Math.min(12, 1 + 1.2 * Math.sqrt(lineTau(line, T, ne))),
      }));
      return { ne, lines };
    }
    function voigtCombined(line: (typeof LINES)[number], T: number, ne: number) {
      const sp = SPECIES[line.species as keyof typeof SPECIES];
      const mass = sp?.massAMU ?? 16;
      const fG = dopplerFWHM_nm(line.nm, T, mass);
      const fL = lorentzFWHM_nm(line.nm, ne);
      return Math.sqrt(fG * fG + fL * fL) * 4; // combined FWHM (nm), widened a touch for visibility
    }

    function fluxAt(nm: number, lines: { nm: number; depth: number; fwhm: number }[]): number {
      let atten = 1;
      for (const l of lines) {
        const dx = nm - l.nm;
        if (Math.abs(dx) > l.fwhm * 8) continue;
        atten *= 1 - l.depth * pseudoVoigtNorm(dx, l.fwhm);
      }
      return Math.max(0, atten);
    }
    // pseudoVoigt() peaks at 1 already for dx=0 given fG,fL as FWHM in our combined sense;
    // treat `fwhm` as both Gaussian and Lorentzian FWHM equally split for a soft, visible dip.
    function pseudoVoigtNorm(dx: number, fwhm: number) {
      return pseudoVoigt(dx, fwhm, fwhm * 0.4);
    }

    function redraw() {
      readT.set(`${fmt(T, 4)} K`);
      const st = spectralSubtype(T);
      readType.set(`${st.letter}${st.sub}`);
      const { ne, lines } = computeSpectrum();
      readNe.set(`${fmt(ne * 1e-6, 3)} cm⁻³`);

      const peak = continuum(650, Math.max(T, 2500)) || 1;
      const contPeakLam = 2.897771955e6 / T; // nm, Wien
      const norm = continuum(Math.min(Math.max(contPeakLam, LAM_MIN), LAM_MAX), T) || peak;

      plot.draw(() => {
        plot.fn((nm) => (continuum(nm, T) / norm) * fluxAt(nm, lines), { color: pal.series[0], width: 1.8 });
        plot.fn((nm) => continuum(nm, T) / norm, { color: pal.muted, width: 1, dash: [2, 3], alpha: 0.6 });
        if (labelsOn) {
          // label visible lines left to right, skipping labels that would collide with the previous one
          let lastEnd = -1e9;
          const vis = lines.filter((l) => l.depth >= 0.04 && l.nm >= LAM_MIN && l.nm <= LAM_MAX).sort((a, b) => a.nm - b.nm);
          for (const l of vis) {
            const X = plot.px(l.nm);
            const pair = l.line.id === 'CaK' || l.line.id === 'CaH' ? 'Ca II H & K' : l.line.id.startsWith('NaD') ? 'Na D' : l.line.label;
            const room = X > lastEnd;
            plot.vline(l.nm, { color: lineColor(l.line.category), alpha: 0.35, label: room ? pair : undefined });
            if (room) lastEnd = X + 10 + pair.length * 6;
          }
        }
      });

      drawStrip(lines);
    }

    function lineColor(cat: string) {
      return cat === 'H' ? pal.series[0] : cat === 'He' ? pal.series[2] : cat === 'molecule' ? pal.series[3] : pal.series[1];
    }

    function drawStrip(lines: { nm: number; depth: number; fwhm: number }[]) {
      const dpr = window.devicePixelRatio || 1;
      const w = strip.clientWidth || 600, h = 52;
      strip.width = Math.round(w * dpr);
      strip.height = Math.round(h * dpr);
      const ctx = strip.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const img = ctx.createImageData(Math.round(w), 1);
      for (let x = 0; x < img.width; x++) {
        const nm = LAM_MIN + (x / img.width) * (LAM_MAX - LAM_MIN);
        // beyond the visible band the strip is dark (outside 380–780 nm there is no colour to show)
        const [r, g, b] = nm < 380 || nm > 780 ? [0, 0, 0] : wavelengthRGB(nm);
        const flux = fluxAt(nm, lines);
        img.data[x * 4] = r * 255 * (0.15 + 0.85 * flux);
        img.data[x * 4 + 1] = g * 255 * (0.15 + 0.85 * flux);
        img.data[x * 4 + 2] = b * 255 * (0.15 + 0.85 * flux);
        img.data[x * 4 + 3] = 255;
      }
      // Blit the 1px strip scaled to full height (nearest, no smoothing lost since only x varies).
      const tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = 1;
      tmp.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, img.width, 1, 0, 0, w, h);
    }

    let lastLines: { line: (typeof LINES)[number]; nm: number; depth: number; fwhm: number }[] = [];
    const onMove = (ev: PointerEvent) => {
      const rect = strip.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const nm = LAM_MIN + (x / rect.width) * (LAM_MAX - LAM_MIN);
      let best: (typeof lastLines)[number] | null = null, bestD = 6;
      for (const l of lastLines) {
        const d = Math.abs(l.nm - nm);
        if (l.depth > 0.03 && d < bestD) { bestD = d; best = l; }
      }
      if (best) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${x + 8}px`;
        tooltip.style.top = `${strip.offsetTop - 30}px`;
        tooltip.textContent = `${best.line.label} · ${best.nm.toFixed(1)} nm · depth ${(best.depth * 100).toFixed(0)}%`;
      } else tooltip.style.display = 'none';
    };
    strip.addEventListener('pointermove', onMove);
    strip.addEventListener('pointerleave', () => (tooltip.style.display = 'none'));

    const wrapRedraw = () => {
      const { lines } = computeSpectrum();
      lastLines = lines;
      redraw();
    };
    wrapRedraw();
    stage.onResize(() => wrapRedraw());
    onDestroy(() => strip.removeEventListener('pointermove', onMove));

    return {
      setVisible(v) { if (v) wrapRedraw(); },
      destroy() {},
    };
  },
});

