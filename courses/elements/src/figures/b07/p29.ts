import { figure } from '../../geometry/figure';
import { PRIMES, Rods, divides, gcd, isPrime, notMultipleOf } from './lib';

export default figure({
  caption: 'A is prime and does not measure B; then A and B are prime to one another. The dashed C is the supposed common measure.',
  build(g) {
    const i = g.param('i', 1, { min: 0, max: 5, label: 'A (prime)' });
    const a = PRIMES[i];
    const b0 = g.param('b', 10, { min: 2, max: 20, label: 'B' });
    const b = notMultipleOf(a, b0);
    const R = new Rods(g, Math.max(a, b));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', 2, 0, -2.6, { dashed: true });
    g.claim('A is prime', isPrime(a));
    g.claim('A does not measure B', !divides(a, b));
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
  },
});
