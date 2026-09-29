import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB = m·E and CD = m·F; the ticks show the m copies. G and H are the ends of the first copies.
export default figure({
  build(g) {
    const e = g.param('e', 1.6, { min: 0.3, max: 3, label: 'E' });
    const f = g.param('f', 1.1, { min: 0.3, max: 3, label: 'F' });
    const m = g.param('m', 2, { min: 2, max: 6, label: 'm' });
    rods(g, [
      [{ pts: ['A', 'G', 'B'], parts: [e, (m - 1) * e], unit: e }],
      [{ name: 'E', parts: [e] }],
      [{ pts: ['C', 'H', 'D'], parts: [f, (m - 1) * f], unit: f }],
      [{ name: 'F', parts: [f] }],
    ]);
    g.show('AB = m·E, CD = m·F with m', m);
    g.equal('AB + CD = m·(E + F)', m * e + m * f, m * (e + f));
  },
});
