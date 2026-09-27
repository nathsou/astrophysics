// Page script for appendix A7 (primer-thermo): wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const KB = 1.380649e-23; // J/K
const AMU = 1.66053906660e-27; // kg
const KB_EV = 8.617333e-5; // eV/K

// rms thermal speed of a particle of mass A (atomic mass units) at temperature T
compute('vth', ['Tgas', 'Agas'], ({ Tgas, Agas }) => {
  const v = Math.sqrt((3 * KB * Tgas) / (Agas * AMU));
  return v >= 1000 ? `${fmt(v / 1000, 3)} km/s` : `${fmt(v, 3)} m/s`;
});

// Boltzmann factor for a gap dE (eV) at temperature T (K)
compute('bfac', ['gapE', 'Tlev'], ({ gapE, Tlev }) => {
  const f = Math.exp(-gapE / (KB_EV * Tlev));
  if (f > 0.01) return `${fmt(100 * f, 3)}%`;
  if (f < 1e-300) return 'effectively zero';
  return `1 in ${fmt(1 / f, 2)}`;
});
compute('kTeV', ['Tlev'], ({ Tlev }) => `${fmt(KB_EV * Tlev, 3)} eV`);
