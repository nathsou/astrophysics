import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// D is B taken A times, E is C taken A times.
export default figure({
  caption: 'A multiplying B and C makes D and E: D is A copies of B, E is A copies of C. F is the unit.',
  build(g) {
    const a = g.param('a', 3, { min: 2, max: 5, label: 'A' });
    const b = g.param('b', 2, { min: 2, max: 6, label: 'B' });
    const c = g.param('c', 5, { min: 2, max: 6, label: 'C' });
    const R = new Rods(g, a * Math.max(b, c));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', a * b, 0, -3.8);
    R.groups(0, -3.8, b, a, 2);
    R.num('E', a * c, 0, -5);
    R.groups(0, -5, c, a, 5);
    R.num('F', 1, 0, -6.4);
    g.show('B : C', ratio(b, c));
    g.show('D : E', ratio(a * b, a * c));
    g.equal('B·E = C·D', b * a * c, c * a * b);
  },
});
