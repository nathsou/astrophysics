import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB = m·C and DE = m·F, cut into copies AG, GH, … and DK, KL, … (Heath draws m = 3).
export default figure({
  build(g) {
    const c = g.param('c', 1, { min: 0.3, max: 2, label: 'C' });
    const f = g.param('f', 0.7, { min: 0.3, max: 2, label: 'F' });
    const m = g.param('m', 3, { min: 3, max: 6, label: 'm' });
    rods(g, [
      [{ pts: ['A', 'G', 'H', 'B'], parts: [c, c, (m - 2) * c], unit: c }],
      [{ name: 'C', parts: [c] }],
      [{ pts: ['D', 'K', 'L', 'E'], parts: [f, f, (m - 2) * f], unit: f }],
      [{ name: 'F', parts: [f] }],
    ]);
    g.equal('C : F = AB : DE', c / f, (m * c) / (m * f));
  },
});
