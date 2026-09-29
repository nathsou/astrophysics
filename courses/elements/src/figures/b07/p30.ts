import { figure } from '../../geometry/figure';
import { PRIMES, Rods, divides, isPrime, notMultipleOf, ratio } from './lib';

// The case of the text: the prime D does not measure A, so it must measure B. B = D·k.
export default figure({
  caption: 'A times B is C, and the prime D measures C, E times. D does not measure A, so it measures B: as D is to A, so is B to E.',
  build(g) {
    const i = g.param('i', 1, { min: 0, max: 3, label: 'which prime D' });
    const d = PRIMES[i];
    const a0 = g.param('a', 4, { min: 2, max: 6, label: 'A' });
    const a = notMultipleOf(d, a0);
    const k = g.param('k', 2, { min: 1, max: 3, label: 'B ÷ D' });
    const b = d * k;
    const c = a * b;
    const e = c / d;
    const R = new Rods(g, c);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.groups(0, -2.4, b, a, 1);
    R.num('D', d, 0, -3.8);
    R.num('E', e, 0, -5);
    g.show('A, B, C, D, E', `${a}, ${b}, ${c}, ${d}, ${e}`);
    g.claim('D is prime', isPrime(d));
    g.claim('D measures C = A·B', divides(d, c));
    g.claim('D does not measure A', !divides(d, a));
    g.equal('D·E = A·B', d * e, a * b);
    g.show('D : A = B : E', `${ratio(d, a)} = ${ratio(b, e)}`);
    g.claim('D measures B', divides(d, b));
  },
});
