import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// C measures A d times and B e times; the numbers D and E are rods of units.
export default figure({
  caption: 'C measures A as many times as there are units in D, and B as many times as there are units in E. So A : B = D : E.',
  build(g) {
    const c = g.param('c', 0.9, { min: 0.4, max: 1.2, step: 0.01, label: 'C' });
    const d = g.param('d', 5, { min: 1, max: 7, label: 'D' });
    const e = g.param('e', 3, { min: 1, max: 7, label: 'E' });
    const L = Lines.fit(g, 7 * 1.2, 8);
    L.mag('A', d * c, 0, 4, { ticks: c });
    L.mag('B', e * c, 0, 3, { ticks: c });
    L.mag('C', c, 0, 2);
    const N = Lines.fit(g, 7, 5);
    N.mag('D', d, 0, 1, { ticks: 1 });
    N.mag('E', e, 0, 0, { ticks: 1 });
    g.equal('A : B = D : E', (d * c) / (e * c), d / e);
  },
});
