// Page script for chapter "main-sequence": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

compute('tauM', ['Mtau'], ({ Mtau }) => {
  const tau = 1e10 * Mtau ** -2.5;
  if (tau > 1e9) return `${fmt(tau / 1e9, 3)} Gyr`;
  if (tau > 1e6) return `${fmt(tau / 1e6, 3)} Myr`;
  return `${fmt(tau, 3)} yr`;
});
compute('LM', ['Mtau'], ({ Mtau }) => {
  const L = Mtau < 0.43 ? 0.23 * Mtau ** 2.3 : Mtau < 2 ? Mtau ** 4 : Mtau < 20 ? 1.5 * Mtau ** 3.5 : 3200 * Mtau;
  return `${fmt(L, 3)} L☉`;
});
