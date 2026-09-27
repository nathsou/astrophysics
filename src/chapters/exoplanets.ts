// Page script for chapter "exoplanets": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// RV semi-amplitude K = (2*pi*G/P)^(1/3) * (Mp sin i) / (Mstar+Mp)^(2/3) / sqrt(1-e^2)
// Var inputs are given in convenient units: P in days, Mp in Earth masses, Mstar in Msun.
compute('K', ['P_rv', 'Mp_rv', 'Mstar_rv'], ({ P_rv, Mp_rv, Mstar_rv }) => {
  const G = 6.6743e-11, Mearth = 5.9722e24, Msun = 1.98847e30;
  const P = P_rv * 86400;
  const Mstar = Mstar_rv * Msun;
  const Mp = Mp_rv * Mearth;
  const K = Math.pow((2 * Math.PI * G) / P, 1 / 3) * (Mp / Math.pow(Mstar + Mp, 2 / 3));
  return `${fmt(K, 3)} m/s`;
});

// Transit depth (Rp/R*)^2, given in ppm and percent.
compute('depth', ['Rp_t', 'Rstar_t'], ({ Rp_t, Rstar_t }) => {
  const Rearth = 6.371e6, Rsun = 6.957e8;
  const ratio = (Rp_t * Rearth) / (Rstar_t * Rsun);
  const depth = ratio * ratio;
  return `${fmt(depth * 1e6, 3)} ppm (${fmt(depth * 100, 3)}%)`;
});

// Transit probability ~ R*/a.
compute('ptransit', ['Rstar_p', 'a_p'], ({ Rstar_p, a_p }) => {
  const Rsun = 6.957e8, AU = 1.495978707e11;
  const p = (Rstar_p * Rsun) / (a_p * AU);
  return `${fmt(p * 100, 3)}%`;
});

// Habitable-zone distance ~ sqrt(L) (conservative inner/outer edges).
compute('hzInner', ['L_hz'], ({ L_hz }) => `${fmt(Math.sqrt(L_hz / 1.1), 3)} AU`);
compute('hzOuter', ['L_hz'], ({ L_hz }) => `${fmt(Math.sqrt(L_hz / 0.36), 3)} AU`);
