import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo } from './lib';

// A, B are each prime to each of C, D; E = A·B, F = C·D.
export default figure({
  caption: 'Each of A, B is prime to each of C, D. Then the products E = A·B and F = C·D are prime to one another.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 5, label: 'A' });
    const b = g.param('b', 3, { min: 2, max: 5, label: 'B' });
    const c0 = g.param('c', 5, { min: 2, max: 7, label: 'C' });
    const d0 = g.param('d', 7, { min: 2, max: 7, label: 'D' });
    const c = primeTo(a * b, c0);
    const d = primeTo(a * b, d0);
    const E = a * b;
    const F = c * d;
    const R = new Rods(g, Math.max(E, F));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    R.num('E', E, 0, -5);
    R.groups(0, -5, b, a, 1);
    R.num('F', F, 0, -6.2);
    R.groups(0, -6.2, d, c, 1);
    g.claim('A, B each prime to C, D', [a, b].every((x) => [c, d].every((y) => gcd(x, y) === 1)));
    g.equal('gcd(E, C) = 1', gcd(E, c), 1);
    g.equal('gcd(E, F) = 1', gcd(E, F), 1);
  },
});
