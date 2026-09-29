import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// A = B·C: B measures A, C times, so C is the B-th part of A.
export default figure({
  caption: 'B measures A, C times; so A is made of B copies of C, and C is the part of A named after B (a third, if B is three). D is the unit.',
  build(g) {
    const b = g.param('b', 3, { min: 2, max: 6, label: 'B' });
    const c = g.param('c', 4, { min: 2, max: 6, label: 'C' });
    const a = b * c;
    const R = new Rods(g, a);
    R.num('A', a, 0, 0);
    R.groups(0, 0, c, b, 4);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', 1, 0, -3.6);
    g.equal('B measures A, C times', a / b, c);
    g.equal('C is the B-th part of A', a / c, b);
  },
});
