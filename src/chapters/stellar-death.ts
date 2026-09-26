// Page script for chapter "stellar-death": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Chandrasekhar mass from the closed-form estimate M_Ch ≈ 5.836 / mu_e^2 (Msun).
compute('Mch', ['muE'], ({ muE }) => `${fmt(5.836 / (muE * muE), 4)} M☉`);

// Electron Fermi momentum relative to m_e c for a given number density (m^-3), via p_F = hbar (3 pi^2 n)^(1/3).
compute('beta', ['n'], ({ n }) => {
  const hbar = 1.054571817e-34, me = 9.1093837015e-31, c = 2.99792458e8;
  const pF = hbar * Math.cbrt(3 * Math.PI * Math.PI * n);
  return fmt(pF / (me * c), 3);
});
