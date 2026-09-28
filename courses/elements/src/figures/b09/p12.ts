import { figure } from '../../geometry/figure';
import { LogRods, divides, isPrime, primeDivisors } from './lib';

const AS = [6, 10, 12, 15, 14, 18, 21];

// A, B, C, D = a, a², a³, a⁴. E is a prime measuring D; F = D/E, G = C/E, H = B/E.
export default figure({
  caption: 'A, B, C, D in continued proportion from the unit; the prime E measures D. Then E measures C (according to G), B (according to H), and finally A. So D and A are measured by the same primes. Logarithmic scale: the primes are the pieces of each rod.',
  build(g) {
    const i = g.param('i', 0, { min: 0, max: AS.length - 1, label: 'which A' });
    const a = AS[i];
    const ps = primeDivisors(a);
    const j = g.param('j', 1, { min: 0, max: 1, label: 'which prime E' });
    const e = ps[j % ps.length];
    const [A, B, C, D] = [1, 2, 3, 4].map((k) => a ** k);
    const R = new LogRods(g, D);
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.1);
    R.num('C', C, 0, -2.2);
    R.num('D', D, 0, -3.3);
    R.num('E', e, 0, -4.7);
    R.num('F', D / e, 0, -5.8);
    R.num('G', C / e, 0, -6.9);
    R.num('H', B / e, 0, -8.0);
    g.claim('E is prime and measures D', isPrime(e) && divides(e, D));
    g.equal('E·F = D = A·C', e * (D / e), A * C);
    g.claim('E measures C (according to G)', divides(e, C));
    g.claim('E measures B (according to H)', divides(e, B));
    g.claim('E measures A', divides(e, A));
    g.show('primes of D; of A', `${primeDivisors(D).join(', ')}; ${ps.join(', ')}`);
  },
});
