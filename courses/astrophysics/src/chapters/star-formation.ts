// Page script for chapter "star-formation": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';
import { jeans } from '../sims/star-formation/physics';

compute('jMJ', ['jn', 'jT'], ({ jn, jT }) => `${fmt(jeans(jn, jT).MJ, 3)} M☉`);
compute('jLam', ['jn', 'jT'], ({ jn, jT }) => `${fmt(jeans(jn, jT).lambdaPc, 3)} pc`);
compute('jTff', ['jn', 'jT'], ({ jn, jT }) => {
  const t = jeans(jn, jT).tffMyr;
  return t < 1e-3 ? `${fmt(t * 1e6, 3)} yr` : t < 1 ? `${fmt(t * 1e3, 3)} kyr` : `${fmt(t, 3)} Myr`;
});
compute('jCs', ['jn', 'jT'], ({ jn, jT }) => `${fmt(jeans(jn, jT).cs / 1e3, 3)} km/s`);

// Kelvin–Helmholtz time of a contracting star: t_KH ≈ G M² / (R L), with main-sequence-like R(M), L(M)
compute('tKH', ['khM', 'khR', 'khL'], ({ khM, khR, khL }) => {
  const t = (6.6743e-11 * (khM * 1.98847e30) ** 2) / (khR * 6.957e8 * khL * 3.828e26) / 3.15576e7;
  return t < 1e6 ? `${fmt(t / 1e3, 3)} thousand years` : `${fmt(t / 1e6, 3)} million years`;
});
