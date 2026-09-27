// Page script for chapter "structure": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const h = 0.68;

const rhoCrit = 2.775e11 * h * h; // M☉ / Mpc³
const rhoMh = 0.31 * 2.775e11; // (M☉/h) per (Mpc/h)³
const Gkpc = 4.301e-6; // kpc (km/s)² / M☉

// Particle mass of a cosmological box of side L (Mpc) sampled by N³ particles.
compute('mpart', ['L', 'Np'], ({ L, Np }) => `${fmt((rhoMh * L ** 3) / Math.round(Np) ** 3, 2)} M☉/h`);
compute('ntot', ['Np'], ({ Np }) => fmt(Math.round(Np) ** 3, 3));
compute('mwParts', ['L', 'Np'], ({ L, Np }) => fmt((1.3e12 * h) / ((rhoMh * L ** 3) / Math.round(Np) ** 3), 2));

// Virial radius and circular velocity of a halo of mass M (M☉), Δ = 200 ρ_crit.
const r200 = (M: number) => Math.cbrt((3 * M) / (4 * Math.PI * 200 * rhoCrit)) * 1000; // kpc
compute('r200', ['Mh'], ({ Mh }) => `${fmt(r200(Mh), 3)} kpc`);
compute('v200', ['Mh'], ({ Mh }) => `${fmt(Math.sqrt((Gkpc * Mh) / r200(Mh)), 3)} km/s`);
