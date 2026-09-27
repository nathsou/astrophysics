// Page script for chapter "energy-transport": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Mass-luminosity relation from radiative diffusion + virial scaling: L ~ M^3 for constant kappa.
compute('Lmass', ['Mms'], ({ Mms }) => `${fmt(Math.pow(Mms, 3), 4)} L☉`);

// Photon random-walk / Fermi-box diffusion time: t ~ R^2 / (ell c), in years.
compute('tdiff', ['ell'], ({ ell }) => {
  const Rsun = 6.957e10; // cm
  const c = 2.998e10; // cm/s
  const N = (Rsun / ell) ** 2;
  const tSec = (Rsun * Rsun) / (ell * c);
  const tYr = tSec / 3.15576e7;
  return `N ≈ ${fmt(N, 3)} steps, t ≈ ${fmt(tYr, 3)} yr`;
});
