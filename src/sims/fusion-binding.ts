// Secondary figure: binding energy per nucleon vs mass number, with the semi-empirical mass
// formula, hoverable isotopes, and arrows showing why fusion pays below the iron peak and
// fission pays above it.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

// Semi-empirical mass formula coefficients (MeV), Wapstra-parametrisation-ish.
const aV = 15.75, aS = 17.8, aC = 0.711, aA = 23.7, aP = 11.18;
function bindingPerNucleon(A: number, Z: number): number {
  const N = A - Z;
  const vol = aV * A;
  const surf = -aS * A ** (2 / 3);
  const coul = -aC * (Z * (Z - 1)) / A ** (1 / 3);
  const asym = -aA * (N - Z) ** 2 / A;
  const delta = A % 2 !== 0 ? 0 : (Z % 2 === 0 ? aP / Math.sqrt(A) : -aP / Math.sqrt(A));
  const B = vol + surf + coul + asym + delta;
  return Math.max(B, 0) / A;
}
// Beta-stability valley: Z(A) that minimises the mass formula at fixed A (closed form from dB/dZ = 0).
function stableZ(A: number): number {
  return Math.round(A / (2 + (aC / (2 * aA)) * A ** (2 / 3)));
}

const ISOTOPES: { A: number; Z: number; label: string }[] = [
  { A: 2, Z: 1, label: '²H (deuterium)' },
  { A: 4, Z: 2, label: '⁴He' },
  { A: 7, Z: 3, label: '⁷Li' },
  { A: 12, Z: 6, label: '¹²C' },
  { A: 16, Z: 8, label: '¹⁶O' },
  { A: 20, Z: 10, label: '²⁰Ne' },
  { A: 28, Z: 14, label: '²⁸Si' },
  { A: 56, Z: 26, label: '⁵⁶Fe' },
  { A: 84, Z: 36, label: '⁸⁴Kr' },
  { A: 120, Z: 50, label: '¹²⁰Sn' },
  { A: 184, Z: 74, label: '¹⁸⁴W' },
  { A: 208, Z: 82, label: '²⁰⁸Pb' },
  { A: 235, Z: 92, label: '²³⁵U' },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 8 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1, max: 240, label: 'mass number A' },
      y: { min: 0, max: 9.2, label: 'binding energy / nucleon (MeV)' },
      title: 'Binding energy per nucleon',
    });

    let hoverA = -1;
    stage.canvas.addEventListener('pointermove', (e) => {
      const rect = stage.canvas.getBoundingClientRect();
      const A = plot.dx(e.clientX - rect.left);
      let best = -1, bestD = Infinity;
      for (const iso of ISOTOPES) { const d = Math.abs(iso.A - A); if (d < bestD) { bestD = d; best = iso.A; } }
      hoverA = bestD < plot.o.x.max * 0.05 ? best : -1;
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointerleave', () => { hoverA = -1; loop.invalidate(); });

    function render() {
      plot.draw(() => {
        plot.fn((A) => bindingPerNucleon(Math.round(A), Math.max(1, stableZ(Math.round(A)))), {
          color: pal.accent, samples: 240,
        });
        for (const iso of ISOTOPES) {
          const b = bindingPerNucleon(iso.A, iso.Z);
          const hot = iso.A === hoverA;
          plot.point(iso.A, b, { r: hot ? 5.5 : 3.5, color: hot ? pal.accent2 : pal.series[0] });
          if (hot) plot.text(`${iso.label}: ${b.toFixed(2)} MeV/nucleon`, plot.px(iso.A) + 8, plot.py(b) - 8, { color: pal.fg });
        }
        // Arrows: fusion pays below the peak, fission pays above it.
        const peakA = 56;
        plot.text('fusion releases energy →', plot.px(20), plot.py(1.2), { color: pal.good, align: 'left' });
        plot.text('← fission releases energy', plot.px(220), plot.py(1.2), { color: pal.bad, align: 'right' });
        plot.vline(peakA, { color: pal.muted, label: 'iron peak (⁵⁶Fe, ⁵⁶Ni)' });
      });
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    const panel = new Panel(host);
    panel.button('Explain the dip at A→1', () => {
      alert('Binding energy per nucleon is 0 for a lone nucleon by definition — there is nothing to bind. It rises fast (He, C, O) as the strong force saturates, peaks near iron/nickel where surface and Coulomb terms balance volume binding, then falls slowly as Coulomb repulsion between many protons chips away at heavy nuclei.');
    });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
