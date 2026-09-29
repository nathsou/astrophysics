import { figure } from '../../geometry/figure';
import { LogRods, PRIMES, divides, lcmAll, primeDivisors } from './lib';

// A = lcm(B, C, D) = B·C·D for distinct primes. E is a supposed further prime, F = A / E.
export default figure({
  caption: 'A is the least number measured by the primes B, C, D, that is, their product. On this logarithmic scale A is B, C, D laid end to end. The dashed E is a prime outside the list that the reductio supposes to measure A, and F the quotient; F is not a number.',
  build(g) {
    const i = g.param('i', 0, { min: 0, max: 2, label: 'B' });
    const j = g.param('j', 0, { min: 0, max: 1, label: 'C' });
    const k = g.param('k', 0, { min: 0, max: 1, label: 'D' });
    const b = PRIMES[i];
    const c = PRIMES[i + 1 + j];
    const d = PRIMES[i + 2 + j + k];
    const a = lcmAll(b, c, d);
    const e = PRIMES.find((p) => ![b, c, d].includes(p))!;
    const R = new LogRods(g, a);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    R.num('E', e, 0, -5, { dashed: true });
    R.num('F', a / e, 0, -6.2, { dashed: true });
    g.equal('A = lcm(B, C, D) = B·C·D', a, b * c * d);
    g.show('primes measuring A', primeDivisors(a).join(', '));
    g.claim('no prime but B, C, D measures A', primeDivisors(a).join() === [b, c, d].join());
    g.claim('E does not measure A', !divides(e, a));
  },
});
