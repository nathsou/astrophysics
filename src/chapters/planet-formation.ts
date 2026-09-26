// Page script for chapter "planet-formation": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';
import { aspect, isolationMass, viscousTime, snowLine, temperature, mmsn } from '../sims/planet-formation/disk-model';

const d = mmsn();
compute('hOut', ['rH'], ({ rH }) => `H/r ≈ ${fmt(aspect(d, rH), 2)}, so H ≈ ${fmt(aspect(d, rH) * rH, 2)} AU (T ≈ ${fmt(temperature(d, rH), 3)} K)`);
compute('snowOut', ['Lsnow'], ({ Lsnow }) => `${fmt(snowLine(Lsnow), 3)} AU`);
compute('isoOut', ['rIso', 'sIso'], ({ rIso, sIso }) => `${fmt(isolationMass({ ...d, sigmaScale: sIso }, rIso), 2)} M⊕`);
compute('tvisc', ['rVisc', 'aVisc'], ({ rVisc, aVisc }) => {
  const t = viscousTime(d, rVisc, aVisc);
  return t > 1e6 ? `${fmt(t / 1e6, 2)} Myr` : `${fmt(t / 1e3, 2)} kyr`;
});
