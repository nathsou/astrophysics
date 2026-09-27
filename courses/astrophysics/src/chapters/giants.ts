// Page script for chapter "giants": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Schönberg–Chandrasekhar-style estimate: max fraction of stellar mass an isothermal
// He core can support in hydrostatic equilibrium before it must contract, q_SC ~ 0.37 (mu_env/mu_core)^2.
compute('qsc', ['muRatio'], ({ muRatio }) => `${fmt(0.37 * muRatio * muRatio, 3)}`);

// Simple He-core mass at the tip of the RGB / at flash for a given total mass, from the toy tracks.
compute('coreMass', ['starMass'], ({ starMass }) => `${fmt(0.47 + 0.02 * Math.log10(Math.max(starMass, 0.5)), 2)} M☉`);

// Degeneracy check: compare thermal energy to Fermi energy for a given core density (toy estimate).
compute('degen', ['rho7'], ({ rho7 }) => {
  // rho7 = density in units of 1e7 kg/m^3; Fermi energy for non-relativistic e- gas ~ rho^(2/3)
  const EF_keV = 3.65 * Math.pow(rho7, 2 / 3); // calibrated so rho7=1 -> EF ~ a few keV, illustrative only
  return `${fmt(EF_keV, 3)} keV`;
});
