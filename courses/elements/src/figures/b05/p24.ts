import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB : C = DE : F and BG : C = EH : F (F and EH computed).
export default figure({
  build(g) {
    const ab = g.param('ab', 1.5, { min: 0.5, max: 2.5, label: 'AB' });
    const bg = g.param('bg', 1, { min: 0.3, max: 2, label: 'BG' });
    const c = g.param('c', 1.1, { min: 0.5, max: 2, label: 'C' });
    const de = g.param('de', 1.2, { min: 0.5, max: 2.5, label: 'DE' });
    const f = (de * c) / ab;
    const eh = (bg * f) / c;
    rods(g, [
      [{ pts: ['A', 'B', 'G'], parts: [ab, bg] }],
      [{ name: 'C', parts: [c] }],
      [{ pts: ['D', 'E', 'H'], parts: [de, eh] }],
      [{ name: 'F', parts: [f] }],
    ]);
    g.equal('AB : BG = DE : EH', ab / bg, de / eh);
    g.equal('AG : C = DH : F', (ab + bg) / c, (de + eh) / f);
  },
});
