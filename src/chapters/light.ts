// Page script for chapter "light": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Wien's displacement law: lambda_peak = b / T
compute('lambdaPeak', ['Twien'], ({ Twien }) => {
  const lam = 2.897771955e6 / Twien; // nm, since b = 2.8978e-3 m K = 2.8978e6 nm K
  return lam < 1000 ? `${fmt(lam, 3)} nm` : `${fmt(lam / 1000, 3)} μm`;
});

// Planetary equilibrium temperature: T_eq = T_star * sqrt(R_star / 2a) * (1-A)^(1/4)
// R_star in R_sun, a in AU: R_sun/AU = 6.957e8 / 1.495978707e11
const RSUN_OVER_AU = 6.957e8 / 1.495978707e11;
compute('Teq', ['Tstar2', 'a2', 'A2'], ({ Tstar2, a2, A2 }) => {
  const T = Tstar2 * Math.sqrt(RSUN_OVER_AU / (2 * a2)) * (1 - A2) ** 0.25;
  return `${fmt(T, 4)} K`;
});
