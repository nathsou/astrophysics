import { figure } from '../../geometry/figure';
import { Rods, divides, gcd, primeTo } from './lib';

// A = C·k and B is prime to A.
export default figure({
  caption: 'A, B are prime to one another and C measures A; then C is prime to B. The dashed D is the supposed common measure of C and B.',
  build(g) {
    const c = g.param('c', 3, { min: 2, max: 6, label: 'C' });
    const k = g.param('k', 2, { min: 1, max: 3, label: 'A ÷ C' });
    const b0 = g.param('b', 7, { min: 2, max: 16, label: 'B' });
    const A = c * k;
    const b = primeTo(A, b0);
    const R = new Rods(g, Math.max(A, b));
    R.num('A', A, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', 2, 0, -3.8, { dashed: true });
    g.equal('gcd(A, B) = 1', gcd(A, b), 1);
    g.claim('C measures A', divides(c, A));
    g.equal('gcd(C, B) = 1', gcd(c, b), 1);
  },
});
