// Page script for chapter "gravitational-waves": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';
import { tauFromF, fdot, nCycles, fISCO, petersMergerTime, aFromP, YR } from '../sims/gravitational-waves/physics';

function duration(s: number): string {
  if (s < 1) return `${fmt(s * 1e3, 3)} ms`;
  if (s < 120) return `${fmt(s, 3)} s`;
  if (s < 7200) return `${fmt(s / 60, 3)} minutes`;
  if (s < 2 * 86400) return `${fmt(s / 3600, 3)} hours`;
  if (s < YR) return `${fmt(s / 86400, 3)} days`;
  if (s < 1e6 * YR) return `${fmt(s / YR, 3)} years`;
  if (s < 1e9 * YR) return `${fmt(s / YR / 1e6, 3)} million years`;
  return `${fmt(s / YR / 1e9, 3)} billion years`;
}

// chirp-mass calculator
compute('tauc', ['Mc', 'f0'], ({ Mc, f0 }) => duration(tauFromF(Mc, f0)));
compute('fdotc', ['Mc', 'f0'], ({ Mc, f0 }) => `${fmt(fdot(Mc, f0), 3)} Hz/s`);
compute('ncyc', ['Mc', 'f0'], ({ Mc, f0 }) => {
  const fEnd = fISCO(Mc * Math.pow(2, 6 / 5));
  return fEnd <= f0 ? 'none (already past the ISCO)' : fmt(nCycles(Mc, f0, fEnd), 3);
});

// Hulse–Taylor-style binary pulsar (two 1.4 M☉ neutron stars)
compute('tht', ['Pb', 'ecc'], ({ Pb, ecc }) => {
  const m1 = 1.438, m2 = 1.39;
  const a = aFromP(Pb * 3600, m1 + m2);
  return duration(petersMergerTime(m1, m2, a, ecc));
});
compute('dPdt', ['Pb', 'ecc'], ({ Pb, ecc }) => {
  // Peters–Mathews: dP/dt = −(192π/5) (2π G ℳ / c³ P)^{5/3} F(e)
  const Mc = Math.pow(1.438 * 1.39, 0.6) / Math.pow(2.828, 0.2);
  const P = Pb * 3600, e2 = ecc * ecc;
  const F = (1 + (73 / 24) * e2 + (37 / 96) * e2 * e2) / Math.pow(1 - e2, 3.5);
  const v = (192 * Math.PI / 5) * Math.pow((2 * Math.PI * Mc * 4.925491e-6) / P, 5 / 3) * F;
  return `${fmt(-v, 3)} s/s (${fmt(v * 1e6 * YR, 3)} µs per year)`;
});
