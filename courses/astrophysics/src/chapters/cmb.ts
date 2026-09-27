// Page script for chapter "cmb": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const T0 = 2.7255;
compute('Tz', ['z'], ({ z }) => `${fmt(T0 * (1 + z), 4)} K`);
compute('lamz', ['z'], ({ z }) => {
  const lam = 1.063e-3 / (1 + z); // Wien peak in λ, metres (b / T0 = 1.06 mm)
  return lam > 1e-3 ? `${fmt(lam * 1e3, 3)} mm` : lam > 1e-6 ? `${fmt(lam * 1e6, 3)} μm` : `${fmt(lam * 1e9, 3)} nm`;
});
compute('dT', ['v'], ({ v }) => `${fmt((T0 * v) / 299792.458 * 1e3, 3)} mK`);
compute('ell1', ['rs', 'DM'], ({ rs, DM }) => `ℓ ≈ ${fmt(0.73 * Math.PI * DM * 1000 / rs, 3)} (θ* = ${fmt(rs / (DM * 1000) * 180 / Math.PI, 3)}°)`);
