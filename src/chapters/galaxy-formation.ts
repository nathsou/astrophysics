// Page script for chapter "galaxy-formation": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const LEDD_PER_MSUN = 1.257e31; // W, = 4πG M☉ m_p c / σ_T
const LSUN = 3.828e26, C2 = (2.99792458e8) ** 2, MSUN = 1.98847e30, YR = 3.15576e7;
const T_EDD_MYR = 450.4; // σ_T c / (4π G m_p)

compute('LEdd', ['Mbh'], ({ Mbh }) => `${fmt(LEDD_PER_MSUN * Mbh, 2)} W ≈ ${fmt((LEDD_PER_MSUN * Mbh) / LSUN, 2)} L☉`);
compute('Mdot', ['Mbh', 'eff'], ({ Mbh, eff }) => `${fmt(((LEDD_PER_MSUN * Mbh) / (eff * C2)) * YR / MSUN, 2)} M☉/yr`);
compute('tSal', ['eff'], ({ eff }) => `${fmt((eff / (1 - eff)) * T_EDD_MYR, 3)} Myr`);
compute('tGrow', ['Mseed', 'eff'], ({ Mseed, eff }) => {
  const t = (eff / (1 - eff)) * T_EDD_MYR * Math.log(1e9 / Mseed);
  return t < 1000 ? `${fmt(t, 3)} Myr` : `${fmt(t / 1000, 3)} Gyr`;
});
compute('nFold', ['Mseed'], ({ Mseed }) => fmt(Math.log(1e9 / Mseed), 3));
