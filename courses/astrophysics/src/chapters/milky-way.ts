// Page script for chapter "milky-way": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const G_ASTRO = 4.30091e-6; // kpc (km/s)^2 / Msun

// Escape speed from a point mass approximation of the Galaxy, given its mass within R.
compute('vesc', ['Mgal'], ({ Mgal }) => `${fmt(Math.sqrt((2 * G_ASTRO * Mgal * 1e12) / 8.2), 3)} km/s`);

// Sun's orbital period around the Galactic centre, given R0 and v0.
compute('Tsun', ['R0', 'v0'], ({ R0, v0 }) => {
  const kpcPerKm = 3.2408e-17; // kpc per km
  const period_s = (2 * Math.PI * R0) / (v0 * kpcPerKm); // seconds... see below
  // Simpler: T = 2*pi*R0[kpc]*3.0857e16[km/kpc] / v0[km/s] seconds, converted to Myr.
  const T_s = (2 * Math.PI * R0 * 3.0857e16) / v0;
  const T_Myr = T_s / (3.15576e13);
  return `${fmt(T_Myr, 3)} Myr`;
});
