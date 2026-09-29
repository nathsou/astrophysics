import { figure } from '../../geometry/figure';
import { Rods, divides } from './lib';

// B is the C-th part of A: A = C copies of B.
export default figure({
  caption: 'B is the part of A named after C (a third, if C is three); then C measures A. D is the unit.',
  build(g) {
    const bb = g.param('b', 4, { min: 2, max: 6, label: 'B' });
    const c = g.param('c', 3, { min: 2, max: 6, label: 'C' });
    const a = bb * c;
    const R = new Rods(g, a);
    R.num('A', a, 0, 0);
    R.groups(0, 0, bb, c, 1);
    R.num('B', bb, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', 1, 0, -3.6);
    g.equal('B is the C-th part of A', a / c, bb);
    g.claim('C measures A', divides(c, a));
    g.equal('C measures A, B times', a / c, bb);
  },
});
