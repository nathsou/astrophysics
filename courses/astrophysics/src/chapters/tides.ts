// Page script for chapter "tides": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Roche limits (rigid and fluid bodies) as a function of density ratio rho_planet/rho_moon.
compute('dRigid', ['rho'], ({ rho }) => `${fmt(1.26 * Math.cbrt(rho), 3)} R_planet`);
compute('dFluid', ['rho'], ({ rho }) => `${fmt(2.44 * Math.cbrt(rho), 3)} R_planet`);

// Day length and Earth-Moon distance extrapolated back in time from tidal dissipation, at the
// (roughly constant, order-of-magnitude) present-day rates: recession ≈ 3.8 cm/yr, day-length
// growth ≈ 2 ms/century. Both compound, so this is a rough linear extrapolation, not a precise
// paleo-model — real rates have varied with continental configuration and ocean resonances.
compute('dayLength', ['myrAgo'], ({ myrAgo }) => {
  const deltaSeconds = 2e-3 * (myrAgo * 1e4); // 2 ms/century × (myrAgo/100) centuries... see below
  const hours = 24 - deltaSeconds / 3600;
  return `${fmt(hours, 4)} h/day`;
});
compute('yearLength', ['myrAgo'], ({ myrAgo }) => {
  const deltaSeconds = 2e-3 * (myrAgo * 1e4);
  const hours = 24 - deltaSeconds / 3600;
  return `${fmt((365.25 * 24) / hours, 4)} days`;
});
compute('moonDistance', ['myrAgo'], ({ myrAgo }) => {
  const dNowKm = 384_400;
  const dPastKm = dNowKm - (3.8 * myrAgo * 1e6) / 1e5; // 3.8 cm/yr × yr, converted to km
  return `${fmt(dPastKm, 6)} km`;
});
