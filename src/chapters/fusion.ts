// Page script for chapter "fusion": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// How long the Sun's H-fuel lasts at a given mass and efficiency, scaled from the real number:
// t_MS ~ 10 Gyr * (M/Msun) / (L/Lsun) with L ~ M^3.5, so t ~ 10 Gyr * M^-2.5. Efficiency scales linearly.
compute('tMS', ['mass', 'eff'], ({ mass, eff }) => {
  const t = 10e9 * mass ** -2.5 * (eff / 0.007);
  return t >= 1e9 ? `${fmt(t / 1e9, 3)} Gyr` : `${fmt(t / 1e6, 3)} Myr`;
});

compute('barrierMeV', ['Z1', 'Z2', 'sep'], ({ Z1, Z2, sep }) => `${fmt((1.439964 * Z1 * Z2) / sep, 3)} MeV`);
