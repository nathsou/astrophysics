import { figure } from '../../geometry/figure';
import { Nums, continued, gcd, gcdAll, list, primeToOther, progression, ratio } from './lib';

// A, B, C, D = a³, a²b, ab², b³ with a, b prime to one another, so the extremes A = a³, D = b³ are
// prime to one another for every slider value. E, F, G, H are the smaller numbers of the reductio.
export default figure({
  caption: 'A, B, C, D are in continued proportion and the extremes A, D are prime to one another. The dashed E, F, G, H are the smaller numbers in the same ratio that the reductio supposes, and which cannot exist.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 4, label: 'ratio a' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 5, label: 'ratio b' }));
    const [A, B, C, D] = progression(1, a, b, 4);
    const R = new Nums(g, '8.1', Math.max(A, D), 7);
    const ys = [0, -1.1, -2.2, -3.3];
    (['A', 'B', 'C', 'D'] as const).forEach((n, i) => R.num(n, [A, B, C, D][i], 0, ys[i]));
    // the supposed smaller numbers: drawn at three quarters, dashed, without unit marks
    (['E', 'F', 'G', 'H'] as const).forEach((n, i) => R.num(n, 0.75 * [A, B, C, D][i], 0, ys[i] - 4.6, { dashed: true, ticks: false, value: '?' }));
    g.show('A, B, C, D', list(A, B, C, D));
    g.show('common ratio', ratio(A, B));
    g.claim('A, B, C, D in continued proportion', continued([A, B, C, D]));
    g.equal('gcd(A, D)', gcd(A, D), 1);
    g.equal('gcd(A, B, C, D) = 1: no smaller numbers in the same ratio', gcdAll(A, B, C, D), 1);
  },
});
