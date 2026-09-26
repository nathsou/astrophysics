// Page script for appendix A9 "Quantum Ideas": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const HC_EV_NM = 1239.84193;

// Photon energy for a wavelength in nm.
compute('Ephot', ['lamnm'], ({ lamnm }) => {
  const E = HC_EV_NM / lamnm;
  return E >= 1e3 ? `${fmt(E / 1e3, 3)} keV` : E >= 1 ? `${fmt(E, 3)} eV` : `${fmt(E * 1e3, 3)} meV`;
});

// de Broglie wavelength λ = h / p of an electron with kinetic energy K (eV), non-relativistic.
compute('ldb', ['Ke'], ({ Ke }) => {
  const lam = 1.22643 / Math.sqrt(Ke); // nm
  return lam >= 1 ? `${fmt(lam, 3)} nm` : `${fmt(lam * 1000, 3)} pm`;
});
