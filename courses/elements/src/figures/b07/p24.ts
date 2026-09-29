import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo } from './lib';

// A and B are each prime to C; D = A·B.
export default figure({
  caption: 'A and B are each prime to C, and D is their product; then D is prime to C. The dashed E is the supposed common measure of C and D, F the quotient D ÷ E.',
  build(g) {
    const c = g.param('c', 4, { min: 2, max: 9, label: 'C' });
    const a0 = g.param('a', 3, { min: 2, max: 6, label: 'A' });
    const b0 = g.param('b', 5, { min: 2, max: 6, label: 'B' });
    const a = primeTo(c, a0);
    const b = primeTo(c, b0);
    const D = a * b;
    const R = new Rods(g, Math.max(D, c));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', D, 0, -3.6);
    R.groups(0, -3.6, b, a, 3);
    R.num('E', 2, 0, -5, { dashed: true });
    R.num('F', Math.ceil(D / 2), 0, -6.2, { dashed: true });
    g.equal('gcd(A, C) = 1', gcd(a, c), 1);
    g.equal('gcd(B, C) = 1', gcd(b, c), 1);
    g.equal('gcd(C, D) = 1', gcd(c, D), 1);
  },
});
