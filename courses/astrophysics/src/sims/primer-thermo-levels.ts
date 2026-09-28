// Appendix A7: the Boltzmann factor, live. A population of "atoms" hops between energy levels by
// Metropolis Monte Carlo at temperature T: an upward jump by ΔE is accepted with probability
// (g_j/g_i)·exp(−ΔE/kT), a downward one (almost) always. The level populations relax to
// N_i/N = g_i exp(−E_i/kT) / Z, drawn as outline bars next to the sampled (filled) bars.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { narrowAspect } from './primer-common/stack';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const KB_EV = 8.617333e-5; // eV/K
const NATOMS = 400;

type Preset = 'two' | 'ladder' | 'hydrogen';
interface Levels { E: number[]; g: number[]; name: string[]; unit: 'eps' | 'eV' }

function levels(p: Preset, degeneracy: boolean): Levels {
  if (p === 'two') return { E: [0, 1], g: degeneracy ? [1, 3] : [1, 1], name: ['ground', 'excited'], unit: 'eps' };
  if (p === 'ladder') {
    const E = [0, 1, 2, 3, 4, 5, 6];
    return { E, g: E.map((_, i) => (degeneracy ? 2 * i + 1 : 1)), name: E.map((_, i) => `level ${i}`), unit: 'eps' };
  }
  const n = [1, 2, 3, 4, 5];
  return {
    E: n.map((k) => 13.6057 * (1 - 1 / (k * k))),
    g: n.map((k) => (degeneracy ? 2 * k * k : 1)),
    name: n.map((k) => `n = ${k}`),
    unit: 'eV',
  };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    narrowAspect(stage, 16 / 9, 1.05);
    const ctx = stage.canvas.getContext('2d')!;

    let preset: Preset = 'ladder', degeneracy = false, logScale = false;
    let kTeps = 1.5; // kT in units of the level spacing ε (generic presets)
    let TK = 10000; // temperature in K (hydrogen preset)
    let L = levels(preset, degeneracy);
    const state = new Int32Array(NATOMS);
    const counts = new Float64Array(8);

    const kT = () => (L.unit === 'eV' ? KB_EV * TK : kTeps);

    function theory() {
      const w = L.E.map((E, i) => L.g[i] * Math.exp(-E / kT()));
      const Z = w.reduce((a, b) => a + b, 0);
      return { p: w.map((x) => x / Z), Z };
    }

    function resetAtoms() { state.fill(0); }

    function sweep() {
      const n = L.E.length, t = kT();
      for (let k = 0; k < NATOMS; k++) {
        const a = (Math.random() * NATOMS) | 0;
        const i = state[a];
        const j = i + (Math.random() < 0.5 ? -1 : 1); // symmetric proposal to a neighbour
        if (j < 0 || j >= n) continue;
        const ratio = (L.g[j] / L.g[i]) * Math.exp(-(L.E[j] - L.E[i]) / t);
        if (ratio >= 1 || Math.random() < ratio) state[a] = j;
      }
    }

    function step() { sweep(); }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      const n = L.E.length;
      counts.fill(0);
      for (let a = 0; a < NATOMS; a++) counts[state[a]]++;
      const { p, Z } = theory();

      const top = 38, bot = H - 26;
      const yOf = (i: number) => bot - ((bot - top) * i) / (n - 1 || 1);
      const split = W * 0.56;
      const x0 = 70, x1 = split - 10;
      const gap = (bot - top) / (n - 1 || 1);

      // level lines and dots
      for (let i = 0; i < n; i++) {
        const y = yOf(i);
        ctx.strokeStyle = pal.axis; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillStyle = pal.muted; ctx.textAlign = 'right';
        const eLab = L.unit === 'eV' ? `${fmt(L.E[i], 3)} eV` : `${L.E[i]}ε`;
        ctx.fillText(eLab, x0 - 6, y + 4);
        if (degeneracy && L.g[i] > 1) { ctx.fillStyle = pal.faint; ctx.fillText(`g=${L.g[i]}`, x0 - 6, y + 17); }
        ctx.textAlign = 'left';
      }
      // dots: stacked rows above each line
      const spacing = 5;
      const perRow = Math.max(8, Math.floor((x1 - x0) / spacing));
      ctx.fillStyle = pal.series[0];
      const placed = new Int32Array(n);
      for (let a = 0; a < NATOMS; a++) {
        const i = state[a];
        const k = placed[i]++;
        const rows = Math.ceil(counts[i] / perRow);
        const dy = Math.min(spacing, (gap * 0.8) / Math.max(1, rows));
        const X = x0 + 3 + (k % perRow) * spacing;
        const Y = yOf(i) - 4 - Math.floor(k / perRow) * dy;
        ctx.fillRect(X - 1.6, Y - 1.6, 3.2, 3.2);
      }

      // population bars (horizontal), sampled (filled) vs Boltzmann (outline)
      const bx0 = split + 16, bx1 = W - 50;
      const minF = 1e-6;
      const len = (f: number) => {
        if (logScale) return f <= minF ? 0 : ((Math.log10(f) - Math.log10(minF)) / -Math.log10(minF)) * (bx1 - bx0);
        return f * (bx1 - bx0);
      };
      const bh = Math.min(16, gap * 0.45);
      ctx.strokeStyle = pal.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx0, top - 12); ctx.lineTo(bx0, bot + 8); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const y = yOf(i);
        const fs = counts[i] / NATOMS;
        ctx.fillStyle = pal.series[0]; ctx.globalAlpha = 0.7;
        ctx.fillRect(bx0, y - bh, len(fs), bh);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.accent; ctx.lineWidth = 2;
        ctx.strokeRect(bx0, y - bh, Math.max(0.5, len(p[i])), bh);
        ctx.fillStyle = pal.fg;
        const lab = p[i] < 1e-3 ? fmt(p[i], 2) : `${fmt(100 * p[i], 3)}%`;
        ctx.fillText(lab, Math.min(bx0 + len(p[i]) + 5, W - 46), y - 3);
      }
      ctx.fillStyle = pal.muted;
      if (W >= 480) ctx.fillText(logScale ? 'fraction (log, 10⁻⁶ … 1)' : 'fraction of atoms', bx0 + 6, top - 18);
      ctx.fillStyle = pal.series[0]; ctx.fillRect(14, 10, 10, 8);
      ctx.fillStyle = pal.muted; ctx.fillText(`${NATOMS} atoms (Monte Carlo)`, 30, 18);
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 2; ctx.strokeRect(W - 150, 10, 10, 8);
      ctx.fillStyle = pal.muted; ctx.fillText('Boltzmann', W - 134, 18);
      if (preset === 'hydrogen') { ctx.fillStyle = pal.faint; ctx.fillText('levels not to scale', 14, H - 8); }

      const Emean = L.E.reduce((s, E, i) => s + E * p[i], 0);
      rZ.set(fmt(Z, 4));
      rX.set(`${fmt(100 * (1 - p[0]), 3)}%`);
      rE.set(L.unit === 'eV' ? `${fmt(Emean, 3)} eV` : `${fmt(Emean, 3)} ε`);
      rK.set(L.unit === 'eV' ? `${fmt(kT(), 3)} eV` : `${fmt(kT(), 3)} ε`);
    }

    const loop = new Loop(step, render, 1 / 30);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.select<Preset>('System', [
      { value: 'two', label: 'Two levels' },
      { value: 'ladder', label: 'Evenly spaced ladder' },
      { value: 'hydrogen', label: 'Hydrogen, n = 1…5' },
    ], preset, (v) => {
      preset = v; L = levels(preset, degeneracy); resetAtoms();
      sEps.el.style.display = preset === 'hydrogen' ? 'none' : '';
      sK.el.style.display = preset === 'hydrogen' ? '' : 'none';
      if (preset === 'hydrogen' && !logScale) { logScale = true; tLog.set(true); }
      loop.invalidate();
    });
    const sEps = panel.slider('kT / ε', { min: 0.05, max: 20, value: kTeps, log: true, step: 0.01 }, (v) => { kTeps = v; loop.invalidate(); });
    const sK = panel.slider('Temperature', { min: 2000, max: 60000, value: TK, log: true, step: 10, unit: 'K', format: (v) => fmt(v, 3) }, (v) => { TK = v; loop.invalidate(); });
    sK.el.style.display = 'none';
    panel.toggle('Degeneracy g', degeneracy, (v) => { degeneracy = v; L = levels(preset, degeneracy); loop.invalidate(); });
    const tLog = panel.toggle('Log scale', logScale, (v) => { logScale = v; loop.invalidate(); });
    panel.button('All to ground state', () => { resetAtoms(); loop.invalidate(); });
    const rK = panel.readout('kT');
    const rZ = panel.readout('Z');
    const rX = panel.readout('excited');
    const rE = panel.readout('⟨E⟩');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
