// Page script for chapter "ism": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const PC = 3.0857e18; // cm
const ALPHA_B = 2.6e-13; // case-B recombination coefficient, cm^3/s at ~10^4 K

// Strömgren radius: R_S = (3Q / 4π n² α_B)^{1/3}
compute('RS', ['Q', 'n'], ({ Q, n }) => {
  const R_cm = (3 * Q * 1e48 / (4 * Math.PI * n * n * ALPHA_B)) ** (1 / 3);
  return `${fmt(R_cm / PC, 3)} pc`;
});
