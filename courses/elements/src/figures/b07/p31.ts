import { figure } from '../../geometry/figure';
import { PRIMES, Rods, divides, isPrime } from './lib';

// A = B·t, B = C·s with C prime: the descent A → B → C stops at a prime.
export default figure({
  caption: 'A is composite, measured by B; B is composite, measured by C; C is prime, and it measures A. The descent must stop, because a decreasing sequence of numbers cannot go on for ever.',
  build(g) {
    const i = g.param('i', 0, { min: 0, max: 2, label: 'which prime C' });
    const c = PRIMES[i];
    const s = g.param('s', 3, { min: 2, max: 3, label: 'B ÷ C' });
    const t = g.param('t', 2, { min: 2, max: 3, label: 'A ÷ B' });
    const b = c * s;
    const a = b * t;
    const R = new Rods(g, a);
    R.num('A', a, 0, 0);
    R.groups(0, 0, b, t, 3);
    R.num('B', b, 0, -1.2);
    R.groups(0, -1.2, c, s, 6);
    R.num('C', c, 0, -2.4);
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.claim('B measures A, and B < A', divides(b, a) && b < a);
    g.claim('C measures B, and C < B', divides(c, b) && c < b);
    g.claim('C is prime', isPrime(c));
    g.claim('C measures A', divides(c, a));
  },
});
