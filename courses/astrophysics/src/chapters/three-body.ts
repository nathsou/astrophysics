// Page script for chapter "three-body": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';
import { lagrangePoints, MU_CRIT } from '../sims/three-body/cr3bp';
import { AU } from '../lib/physics/constants';

// Sun–Earth L2 distance as a function of mass ratio (the reader drags μ around 3×10⁻⁶).
compute('l2dist', ['muL2'], ({ muL2 }) => {
  const L = lagrangePoints(muL2);
  const distKm = (Math.abs(L.L2[0] - (1 - muL2)) * AU) / 1000;
  return `${fmt(distKm, 4)} thousand km`;
});

compute('hillR', ['muHill'], ({ muHill }) => `${fmt(Math.cbrt(muHill / 3), 4)} a`);

compute('l45stable', ['muStab'], ({ muStab }) => (muStab < MU_CRIT ? 'stable (Trojan-like)' : 'unstable'));
