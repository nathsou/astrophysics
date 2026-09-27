// Secondary figure: recreate the 1998 argument. Simulated Type Ia supernovae (noisy standard
// candles) plotted as distance modulus vs redshift, compared against a matter-only (no-Λ) model
// and a flat ΛCDM model, with residuals against the no-Λ prediction below.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { luminosityDistanceMpc, type OmegaParams, H0_PLANCK } from './expansion/cosmology';

function mu(dLMpc: number) {
  return 5 * Math.log10(dLMpc) + 25; // distance modulus, dL in Mpc
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr);';
    host.append(wrap);
    const mainStage = createStage(wrap, { aspect: 16 / 8 });
    const resStage = createStage(wrap, { aspect: 16 / 5 });
    for (const st of [mainStage, resStage]) { st.el.style.minHeight = '0'; st.el.style.overflow = 'hidden'; }
    resStage.el.style.borderTop = '1px solid var(--rule)';
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const H0 = H0_PLANCK;
    const noLambda: OmegaParams = { Om: 1, OL: 0, Or: 0 };
    const lcdm: OmegaParams = { Om: 0.315, OL: 0.685, Or: 9.1e-5 };

    const mainPlot = new Plot(mainStage.canvas, {
      x: { min: 0.01, max: 1.2, log: true, label: 'redshift z' },
      y: { min: 34, max: 46, label: 'distance modulus μ' },
      title: 'Hubble diagram: SNe Ia',
    });
    const resPlot = new Plot(resStage.canvas, {
      x: { min: 0.01, max: 1.2, log: true, label: 'redshift z' },
      y: { min: -0.6, max: 0.6, label: 'Δμ vs no-Λ' },
    });

    let nSN = 60, noiseMag = 0.15, seed = 7;
    let sneZ: Float64Array, sneMu: Float64Array;

    function generate() {
      const rnd = mulberry32(seed);
      sneZ = new Float64Array(nSN);
      sneMu = new Float64Array(nSN);
      for (let i = 0; i < nSN; i++) {
        const z = 0.02 * Math.pow(1.2 / 0.02, rnd());
        sneZ[i] = z;
        const trueMu = mu(luminosityDistanceMpc(z, lcdm, H0));
        // Box-Muller
        const u1 = Math.max(rnd(), 1e-9), u2 = rnd();
        const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        sneMu[i] = trueMu + g * noiseMag;
      }
    }
    generate();

    const loop = new Loop(null, render, 1 / 30);
    mainStage.onResize((w, h, d) => { mainPlot.resize(w, h, d); loop.invalidate(); });
    resStage.onResize((w, h, d) => { resPlot.resize(w, h, d); loop.invalidate(); });

    const NZ = 120;
    const zs = new Float64Array(NZ);
    for (let i = 0; i < NZ; i++) zs[i] = 0.01 * Math.pow(1.2 / 0.01, i / (NZ - 1));

    function render() {
      const muNoL = new Float64Array(NZ), muLCDM = new Float64Array(NZ);
      for (let i = 0; i < NZ; i++) {
        muNoL[i] = mu(luminosityDistanceMpc(zs[i], noLambda, H0));
        muLCDM[i] = mu(luminosityDistanceMpc(zs[i], lcdm, H0));
      }
      mainPlot.draw(() => {
        mainPlot.line(zs, muNoL, { color: pal.series[2], dash: [4, 3] });
        mainPlot.line(zs, muLCDM, { color: pal.series[0] });
        mainPlot.scatter(sneZ, sneMu, { color: pal.muted, size: 4 });
        const iz = (z: number) => Math.round((Math.log(z / 0.01) / Math.log(1.2 / 0.01)) * (NZ - 1));
        mainPlot.text('flat ΛCDM (accelerating)', mainPlot.px(0.12), mainPlot.py(muLCDM[iz(0.12)]) - 14, { color: pal.series[0], align: 'right' });
        mainPlot.text('Ωm = 1, ΩΛ = 0 (decelerating)', mainPlot.px(0.3), mainPlot.py(muNoL[iz(0.3)]) + 16, { color: pal.series[2] });
      });
      resPlot.draw(() => {
        resPlot.hline(0, { color: pal.series[2], dash: [4, 3] });
        const dLCDM = new Float64Array(NZ);
        for (let i = 0; i < NZ; i++) dLCDM[i] = muLCDM[i] - muNoL[i];
        resPlot.line(zs, dLCDM, { color: pal.series[0] });
        const dSN = new Float64Array(nSN);
        for (let i = 0; i < nSN; i++) dSN[i] = sneMu[i] - mu(luminosityDistanceMpc(sneZ[i], noLambda, H0));
        resPlot.scatter(sneZ, dSN, { color: pal.muted, size: 4 });
        resPlot.text('Ωm = 1, ΩΛ = 0', resPlot.m.l + 6, resPlot.py(0) + 14, { color: pal.series[2] });
        resPlot.text('flat ΛCDM: fainter = farther', resPlot.px(0.35), resPlot.py(0.55), { color: pal.series[0], align: 'right' });
      });
    }

    const panel = new Panel(host);
    panel.slider('Number of SNe', { min: 10, max: 300, value: nSN, step: 1 }, (v) => { nSN = Math.round(v); generate(); loop.invalidate(); });
    panel.slider('Measurement scatter (mag)', { min: 0.02, max: 0.4, value: noiseMag, step: 0.01, format: (v) => fmt(v, 2) }, (v) => { noiseMag = v; generate(); loop.invalidate(); });
    panel.button('New random sample', () => { seed = (seed * 2654435761 + 1) >>> 0; generate(); loop.invalidate(); });

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
