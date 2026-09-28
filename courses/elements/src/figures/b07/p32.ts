import { figure } from '../../geometry/figure';
import { Rods, divides, isPrime, leastPrimeFactor } from './lib';

export default figure({
  caption: 'A is either prime or measured by a prime. The lower rod is the least prime that measures A (A itself when A is prime).',
  build(g) {
    const a = g.param('a', 12, { min: 2, max: 60, label: 'A' });
    const p = leastPrimeFactor(a);
    const R = new Rods(g, a);
    R.num('A', a, 0, 0);
    R.groups(0, 0, p, a / p, 3);
    R.bare(p, 0, -1.2, `least prime ${p}`, { from: 3 });
    g.show('A is', isPrime(a) ? 'prime' : 'composite');
    g.claim('the lower rod is prime', isPrime(p));
    g.claim('it measures A', divides(p, a));
  },
});
