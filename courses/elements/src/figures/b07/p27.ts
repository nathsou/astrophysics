import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo } from './lib';

// C = A², D = A³, E = B², F = B³.
export default figure({
  caption: 'A, B are prime to one another; C, D are the square and cube of A, and E, F those of B. Then C, E and D, F are prime to one another.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 3, label: 'A' });
    const b0 = g.param('b', 3, { min: 2, max: 4, label: 'B' });
    const b = primeTo(a, b0);
    const R = new Rods(g, Math.max(a ** 3, b ** 3));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', a * a, 0, -2.6);
    R.num('D', a ** 3, 0, -3.8);
    R.groups(0, -3.8, a * a, a, 1);
    R.num('E', b * b, 0, -5.2);
    R.num('F', b ** 3, 0, -6.4);
    R.groups(0, -6.4, b * b, b, 1);
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
    g.equal('gcd(C, E) = 1', gcd(a * a, b * b), 1);
    g.equal('gcd(D, F) = 1', gcd(a ** 3, b ** 3), 1);
  },
});
