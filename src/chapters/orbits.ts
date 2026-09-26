// Page script for chapter "orbits": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

compute('P', ['a', 'M'], ({ a, M }) => {
  const P = Math.sqrt(a ** 3 / M);
  return P < 1 ? `${fmt(P * 365.25, 3)} days` : `${fmt(P, 3)} years`;
});
compute('v', ['a', 'M'], ({ a, M }) => `${fmt(29.78 * Math.sqrt(M / a), 3)} km/s`);
