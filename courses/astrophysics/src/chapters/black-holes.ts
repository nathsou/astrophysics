// Page script for chapter "black-holes": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const RS_KM = 2.9532; // r_s of 1 M☉ in km
const TH = 6.17e-8; // Hawking temperature of 1 M☉ in K
const TEVAP = 2.1e67; // evaporation time of 1 M☉ in yr (photons + gravitons only, rough)

const dist = (km: number) =>
  km < 1e-3 ? `${fmt(km * 1e6, 3)} mm` : km < 1 ? `${fmt(km * 1e3, 3)} m` : km < 1.5e7 ? `${fmt(km, 3)} km` : `${fmt(km / 1.496e8, 3)} AU`;

compute('rs', ['Mbh'], ({ Mbh }) => dist(RS_KM * Mbh));
compute('rho', ['Mbh'], ({ Mbh }) => `${fmt(1.84e19 / (Mbh * Mbh), 2)} kg/m³`);

compute('rate', ['rr'], ({ rr }) => fmt(Math.sqrt(Math.max(0, 1 - 1 / rr)), 4));
compute('hours', ['rr'], ({ rr }) => {
  const a = Math.sqrt(Math.max(0, 1 - 1 / rr));
  const h = 1 / a;
  return h > 8760 * 2 ? `${fmt(h / 8766, 3)} years` : h > 48 ? `${fmt(h / 24, 3)} days` : `${fmt(h, 4)} hours`;
});
compute('zz', ['rr'], ({ rr }) => fmt(1 / Math.sqrt(Math.max(1e-12, 1 - 1 / rr)) - 1, 3));
compute('lam', ['rr'], ({ rr }) => `${fmt(656.3 / Math.sqrt(Math.max(1e-12, 1 - 1 / rr)), 4)} nm`);

// Hawking: mass given in kg on a log slider
compute('TH', ['Mh'], ({ Mh }) => `${fmt((TH * 1.989e30) / Mh, 3)} K`);
compute('tev', ['Mh'], ({ Mh }) => {
  const t = TEVAP * (Mh / 1.989e30) ** 3; // yr
  return t < 1 / 3.156e7 ? `${fmt(t * 3.156e7, 3)} s` : `${fmt(t, 3)} yr`;
});
compute('rsh', ['Mh'], ({ Mh }) => dist((RS_KM * Mh) / 1.989e30));
