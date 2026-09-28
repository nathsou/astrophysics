import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// D is C taken A times, E is C taken B times.
export default figure({
  caption: 'A and B multiplying C make D and E: D is A copies of C, E is B copies of C.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 6, label: 'A' });
    const b = g.param('b', 5, { min: 2, max: 6, label: 'B' });
    const c = g.param('c', 3, { min: 2, max: 5, label: 'C' });
    const R = new Rods(g, c * Math.max(a, b));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', a * c, 0, -3.8);
    R.groups(0, -3.8, c, a, 1);
    R.num('E', b * c, 0, -5);
    R.groups(0, -5, c, b, 1);
    g.show('A : B', ratio(a, b));
    g.show('D : E', ratio(a * c, b * c));
    g.equal('A·E = B·D', a * b * c, b * a * c);
  },
});
