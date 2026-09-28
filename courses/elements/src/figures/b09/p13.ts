import { figure } from '../../geometry/figure';
import { LogRods, PRIMES, divisors } from './lib';

// A prime; B, C, D = A², A³, A⁴. E, F, G, H are the impossible numbers of the reductio.
export default figure({
  caption: 'A, B, C, D in continued proportion from the unit, with A prime. D is measured by A, B, C and by nothing else. The dashed E, F, G, H are the numbers the reductio supposes (E a divisor of D outside the progression, and the quotients that follow from it); on this logarithmic scale they fall between the steps, so none of them is a number.',
  build(g) {
    const i = g.param('i', 0, { min: 0, max: 4, label: 'which prime A' });
    const a = PRIMES[i];
    const [A, B, C, D] = [1, 2, 3, 4].map((k) => a ** k);
    const R = new LogRods(g, D);
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.1);
    R.num('C', C, 0, -2.2);
    R.num('D', D, 0, -3.3);
    // E·F = D, F·G = C, G·H = B, in steps of A: E = 1.5, F = 2.5, G = 0.5, H = 1.5
    const at = (k: number) => a ** k;
    R.num('E', at(1.5), 0, -4.7, { dashed: true });
    R.num('F', at(2.5), 0, -5.8, { dashed: true });
    R.num('G', at(0.5), 0, -6.9, { dashed: true });
    R.num('H', at(1.5), 0, -8.0, { dashed: true });
    const ds = divisors(D).filter((d) => d !== 1 && d !== D);
    g.show('divisors of D', divisors(D).join(', '));
    g.claim('D is measured by A, B, C only (besides 1 and itself)', ds.join() === [A, B, C].join());
  },
});
