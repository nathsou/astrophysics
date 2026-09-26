// Page script for chapter "spectra": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';
import { bohrWavelengthNM, dopplerFWHM_nm, boltzmannRatio, stageFractions, RY_EV } from '../sims/spectra/physics';

compute('bohrLambda', ['nLo', 'nHi'], ({ nLo, nHi }) => {
  const lo = Math.round(nLo), hi = Math.max(lo + 1, Math.round(nHi));
  const nm = bohrWavelengthNM(lo, hi);
  const vis = nm >= 380 && nm <= 750 ? ' (visible)' : nm < 380 ? ' (UV)' : ' (IR)';
  return `${fmt(nm, 4)} nm${vis}`;
});

compute('dopplerWidth', ['Tdop', 'massDop'], ({ Tdop, massDop }) => {
  const fwhm = dopplerFWHM_nm(656.3, Tdop, massDop);
  return `${(fwhm * 1000).toFixed(1)} pm (${fmt((fwhm / 656.3) * 3e5, 3)} km/s)`;
});

compute('n2frac', ['Texc'], ({ Texc }) => {
  const r = boltzmannRatio(2, 8, RY_EV * 0.75, Texc);
  const boltz = r / (1 + r);
  const neutralFrac = stageFractions([13.598], [2, 1], Texc, 1e20)[0];
  return fmt(boltz * neutralFrac, 3);
});
