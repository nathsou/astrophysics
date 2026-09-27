// Page script for chapter "neutron-stars": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const YEAR = 3.15576e7;

// A teaspoon of neutron-star matter.
compute('tsp_mass', ['vol_tsp'], ({ vol_tsp }) => `${fmt(4e17 * vol_tsp * 1e-6, 3)} kg`);

// Flux freezing and angular-momentum conservation during collapse.
compute('P_ns', ['R_star', 'P_star'], ({ R_star, P_star }) => {
  const R_ns = 12; // km
  const P = P_star * (R_ns / R_star) ** 2;
  return P < 1 / 86400 ? `${fmt(P * 86400 * 1000, 3)} ms` : `${fmt(P * 86400, 3)} s`;
});
compute('B_ns', ['B_star', 'R_star'], ({ B_star, R_star }) => {
  const R_ns = 12; // km
  return `${fmt(B_star * (R_star / R_ns) ** 2, 3)} G`;
});

// Magnetic dipole spin-down: characteristic values from P, Ṗ.
compute('sd_B', ['P_sd', 'Pdot_sd'], ({ P_sd, Pdot_sd }) => `${fmt(3.2e19 * Math.sqrt(Math.max(P_sd * Pdot_sd, 0)), 3)} G`);
compute('sd_age', ['P_sd', 'Pdot_sd'], ({ P_sd, Pdot_sd }) => {
  const yr = P_sd / (2 * Pdot_sd) / YEAR;
  return yr > 1e3 ? `${fmt(yr, 3)} yr` : `${fmt(yr * 365.25, 3)} days`;
});
compute('sd_edot', ['P_sd', 'Pdot_sd'], ({ P_sd, Pdot_sd }) => `${fmt((4 * Math.PI * Math.PI * 1e45 * Pdot_sd / P_sd ** 3) * 1e-7, 3)} W`);
