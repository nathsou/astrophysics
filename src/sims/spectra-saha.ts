// Fraction of hydrogen atoms with an electron in n=2 (the level Balmer absorption needs),
// as a function of temperature, with draggable density. Shows why the Balmer lines peak
// near 9,500-10,000 K even though kT there is ~30x smaller than the 10.2 eV needed: at lower
// T almost no atoms reach n=2 (Boltzmann); at higher T hydrogen is mostly ionised (Saha), so
// there is no n=1 left to excite.
import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { boltzmannRatio, stageFractions, RY_EV } from './spectra/physics';

const H_N2_DE = RY_EV * 0.75;

function n2Fraction(T: number, ne_m3: number): { boltz: number; ionFrac: number; total: number } {
  const boltzRatio = boltzmannRatio(2, 8, H_N2_DE, T); // N2/N1 within neutral H
  const boltz = boltzRatio / (1 + boltzRatio); // fraction of neutral H in n=2
  const stages = stageFractions([13.598], [2, 1], T, ne_m3); // [H I, H II]
  const neutralFrac = stages[0];
  return { boltz, ionFrac: neutralFrac, total: boltz * neutralFrac };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); draw(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const panel = new Panel(host);
    const readPeak = panel.readout('Peak near');

    let logNe = 20; // log10(n_e / m^-3); ~1e14 cm^-3 typical photosphere
    panel.slider('log₁₀(electron density / m⁻³)', { min: 16, max: 24, value: logNe, step: 0.1 }, (v) => { logNe = v; draw(); });

    const plot = new Plot(stage.canvas, {
      x: { min: 3000, max: 30000, label: 'temperature (K)' },
      y: { min: 1e-8, max: 1, log: true, label: 'fraction of H atoms in n=2' },
    });
    stage.onResize((w, h, dpr) => plot.resize(w, h, dpr));

    function draw() {
      const ne = 10 ** logNe;
      let peakT = 3000, peakV = 0;
      for (let T = 3000; T <= 30000; T += 50) {
        const v = n2Fraction(T, ne).total;
        if (v > peakV) { peakV = v; peakT = T; }
      }
      readPeak.set(`${fmt(peakT, 3)} K`);
      plot.draw(() => {
        plot.fn((T) => Math.max(n2Fraction(T, ne).boltz, 1e-9), { color: pal.series[2], dash: [3, 3], alpha: 0.7 });
        plot.fn((T) => Math.max(n2Fraction(T, ne).ionFrac, 1e-9), { color: pal.series[3], dash: [3, 3], alpha: 0.7 });
        plot.fn((T) => Math.max(n2Fraction(T, ne).total, 1e-9), { color: pal.series[0], width: 2.2 });
        plot.vline(peakT, { color: pal.accent, label: `peak ${fmt(peakT, 3)} K` });
        plot.vline(9800, { color: pal.muted, dash: [1, 3], label: 'Balmer max (obs.)' });
      });
    }

    draw();
    stage.onResize(() => draw());
    return { setVisible(v) { if (v) draw(); }, destroy() {} };
  },
});
