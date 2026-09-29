import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo } from './lib';

export default figure({
  caption: 'A, B are prime to one another and C = A·A; D is a copy of A. Then C is prime to B.',
  build(g) {
    const a = g.param('a', 3, { min: 2, max: 6, label: 'A' });
    const b0 = g.param('b', 5, { min: 2, max: 12, label: 'B' });
    const b = primeTo(a, b0);
    const R = new Rods(g, Math.max(a * a, b));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', a * a, 0, -2.4);
    R.groups(0, -2.4, a, a, 1);
    R.num('D', a, 0, -3.6);
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
    g.equal('gcd(B, C) = 1', gcd(b, a * a), 1);
  },
});
