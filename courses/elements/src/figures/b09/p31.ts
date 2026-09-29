import { figure } from '../../geometry/figure';
import { Rods, gcd, isOdd, leastPrimeFactor, primeTo } from './lib';

// A odd, B prime to A, C = 2B. The dashed D is a supposed common measure of A and C.
export default figure({
  caption: 'The odd number A is prime to B, and C is double of B. The dashed D is the common measure of A and C that the reductio supposes: it would be odd, so it would measure the half of C, which is B.',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 4, label: 'A = 2m + 1' });
    const b0 = g.param('b', 4, { min: 2, max: 8, label: 'B' });
    const a = 2 * m + 1;
    const b = primeTo(a, b0);
    const c = 2 * b;
    const R = new Rods(g, Math.max(a, c));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.groups(0, -2.4, b, 2);
    R.num('D', leastPrimeFactor(a), 0, -3.8, { dashed: true });
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.claim('A is odd', isOdd(a));
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
    g.equal('gcd(A, C) = 1', gcd(a, c), 1);
  },
});
