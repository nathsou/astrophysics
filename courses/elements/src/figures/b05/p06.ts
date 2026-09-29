import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB = m·E, CD = m·F; AG = n·E, CH = n·F. The remainders are GB = r·E, HD = r·F with r = m − n.
// Heath's first case is r = 1. CK = F is laid off beyond C.
export default figure({
  build(g) {
    const e = g.param('e', 1, { min: 0.4, max: 2, label: 'E' });
    const f = g.param('f', 0.7, { min: 0.4, max: 2, label: 'F' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'n (AG = n·E)' });
    const r = g.param('r', 1, { min: 1, max: 3, label: 'r (GB = r·E)' });
    rods(g, [
      [{ pts: ['A', 'G', 'B'], parts: [n * e, r * e], unit: e, pre: f }],
      [{ name: 'E', parts: [e], pre: f }],
      [{ pts: ['K', 'C', 'H', 'D'], parts: [f, n * f, r * f], unit: f }],
      [{ name: 'F', parts: [f], pre: f }],
    ]);
    g.equal('GB ÷ E = HD ÷ F', r, (r * f) / f);
    g.equal('KH = (n + 1)·F', f + n * f, (n + 1) * f);
    if (r === 1) g.equal('case r = 1: KH = CD', f + n * f, (n + r) * f);
  },
});
