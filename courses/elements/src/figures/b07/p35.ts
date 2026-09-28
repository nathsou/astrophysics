import { figure } from '../../geometry/figure';
import { Rods, divides, lcm } from './lib';

// CD is a common multiple of A and B: k times their least common multiple E.
export default figure({
  caption: 'A and B measure CD, and E is the least number they measure. Copies of E laid off from D along CD leave no remainder: the last piece CF is E itself.',
  build(g) {
    const a = g.param('a', 4, { min: 2, max: 5, label: 'A' });
    const b = g.param('b', 6, { min: 2, max: 7, label: 'B' });
    const k = g.param('k', 3, { min: 2, max: 3, label: 'CD ÷ E' });
    const e = lcm(a, b);
    const cd = k * e;
    const R = new Rods(g, cd);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('E', e, 0, -2.4);
    R.seg('C', 'D', cd, 0, -3.8);
    R.mark('F', 0, -3.8, e);
    R.groups(R.x(e), -3.8, e, k - 1, 2);
    g.show('A, B, E, CD', `${a}, ${b}, ${e}, ${cd}`);
    g.claim('A and B measure CD', divides(a, cd) && divides(b, cd));
    g.equal('CF = CD − DF = E', cd - (k - 1) * e, e);
    g.claim('E measures CD', divides(e, cd));
  },
});
