// Page script for chapter "scales": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Distance modulus: apparent magnitude of a star of absolute magnitude Mabs at dpc parsecs.
compute('mapp', ['Mabs', 'dpc'], ({ Mabs, dpc }) => (Mabs + 5 * Math.log10(dpc / 10)).toFixed(1));
compute('mvis', ['Mabs', 'dpc'], ({ Mabs, dpc }) => {
  const m = Mabs + 5 * Math.log10(dpc / 10);
  return m < 6 ? 'visible to the naked eye' : m < 21 ? 'invisible to the eye but within Gaia’s reach' : m < 31.5 ? 'a job for Hubble or JWST' : 'too faint even for JWST';
});

// Escape speed in km/s for M in M☉ and R in R☉ (v = 617.7 √(M/R) km/s).
compute('vesc', ['vM', 'vR'], ({ vM, vR }) => {
  const v = 617.7 * Math.sqrt(vM / vR);
  return v >= 299792 ? 'faster than light: a black hole' : v > 3e4 ? `${fmt(v, 3)} km/s (${fmt(v / 2997.92, 2)} % of c)` : `${fmt(v, 3)} km/s`;
});

// Maximum mountain height scales as 1/g (Everest-ish ~10 km on Earth).
compute('hmax', ['gfac'], ({ gfac }) => `${fmt(10 / gfac, 2)} km`);
compute('hmaxR', ['gfac'], ({ gfac }) => `${fmt(6371 * gfac, 3)} km`);
