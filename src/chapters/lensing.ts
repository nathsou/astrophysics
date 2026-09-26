// Page script for chapter "lensing": Einstein radius and microlensing timescale calculators.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const G = 6.6743e-11, c = 2.99792458e8, Msun = 1.98847e30, kpc = 3.0856775814913673e19, AU = 1.495978707e11;
const RAD2MAS = (180 / Math.PI) * 3600e3;

function einstein(M: number, DL: number, DS: number) {
  // D in kpc; flat-space distances (fine inside the Galaxy; use angular-diameter distances cosmologically)
  const dl = DL * kpc, ds = Math.max(DS, DL * 1.0001) * kpc, dls = ds - dl;
  const th = Math.sqrt(((4 * G * M * Msun) / (c * c)) * (dls / (dl * ds)));
  return { th, RE: th * dl };
}
const angle = (th: number) => {
  const mas = th * RAD2MAS;
  if (mas < 1) return `${fmt(mas * 1000, 3)} μas`;
  if (mas < 1000) return `${fmt(mas, 3)} mas`;
  return `${fmt(mas / 1000, 3)}″`;
};
compute('thetaE', ['M', 'DL', 'DS'], ({ M, DL, DS }) => angle(einstein(M, DL, DS).th));
compute('RE', ['M', 'DL', 'DS'], ({ M, DL, DS }) => `${fmt(einstein(M, DL, DS).RE / AU, 3)} AU`);
compute('tE', ['M', 'DL', 'DS'], ({ M, DL, DS }) => {
  const t = einstein(M, DL, DS).RE / 200e3 / 86400;
  return t < 2 ? `${fmt(t * 24, 3)} hours` : t > 1000 ? `${fmt(t / 365.25, 3)} years` : `${fmt(t, 3)} days`;
});
