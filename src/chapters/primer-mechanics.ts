// Page script for appendix A6 (primer-mechanics): wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Spin-up of a collapsing Sun at fixed angular momentum: P ∝ I ∝ R² for a fixed mass profile.
const R_SUN_KM = 695_700;
const P_SUN_S = 25.4 * 86400; // equatorial rotation period

function duration(s: number): string {
  if (s < 1) return `${fmt(s * 1000, 3)} milliseconds`;
  if (s < 120) return `${fmt(s, 3)} seconds`;
  if (s < 7200) return `${fmt(s / 60, 3)} minutes`;
  if (s < 2 * 86400) return `${fmt(s / 3600, 3)} hours`;
  return `${fmt(s / 86400, 3)} days`;
}

compute('spinP', ['Rcollapse'], ({ Rcollapse }) => duration(P_SUN_S * (Rcollapse / R_SUN_KM) ** 2));
compute('spinV', ['Rcollapse'], ({ Rcollapse }) => {
  const v = (2 * Math.PI * Rcollapse) / (P_SUN_S * (Rcollapse / R_SUN_KM) ** 2); // km/s at the equator
  return v > 3e5 ? `${fmt(v / 3e5, 3)} times the speed of light (impossible: something must shed angular momentum)` : `${fmt(v, 3)} km/s`;
});
