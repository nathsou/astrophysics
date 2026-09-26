// Page script for chapter "galactic-dynamics": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const KPC_KMS_YR = 3.0857e16 / 3.156e7; // 1 kpc / (1 km/s) in years (≈ 0.978 Gyr)

const years = (y: number) =>
  y >= 1e9 ? `${fmt(y / 1e9, 3)} billion years` : y >= 1e6 ? `${fmt(y / 1e6, 3)} million years` : `${fmt(y, 3)} years`;

compute('tcross', ['R', 'v'], ({ R, v }) => years((R / v) * KPC_KMS_YR));
compute('trelax', ['Nstars', 'R', 'v'], ({ Nstars, R, v }) => {
  const tc = (R / v) * KPC_KMS_YR;
  return years((Nstars / (8 * Math.log(Nstars))) * tc);
});
compute('relaxAge', ['Nstars', 'R', 'v'], ({ Nstars, R, v }) => {
  const tr = (Nstars / (8 * Math.log(Nstars))) * (R / v) * KPC_KMS_YR;
  const r = tr / 13.8e9;
  return r >= 1 ? `${fmt(r, 2)} times the age of the Universe` : `${fmt(r * 100, 2)}% of the age of the Universe`;
});
