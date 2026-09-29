import { figure } from '../../geometry/figure';
import { Nums, continued, gcd, list, primeToOther, progression } from './lib';

// A, C, D, B = a³, a²b, ab², b³ with A, B prime to one another. E is the unit. F, G = a, b;
// H, K, L = a², ab, b²; M, N, O, P = A, C, D, B.
export default figure({
  caption: 'A, B are prime to one another and C, D fall between them in continued proportion. With the unit E: E, F, H, A and E, G, L, B are in continued proportion too.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 3, label: 'ratio a' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 4, label: 'ratio b' }));
    const [A, C, D, B] = progression(1, a, b, 4);
    const [F, G] = [a, b];
    const [H, K, L] = progression(1, a, b, 3);
    const R = new Nums(g, '8.9', Math.max(A, B), 5);
    const x2 = 7.2;
    R.num('A', A, 0, 0);
    R.num('C', C, 0, -1);
    R.num('D', D, 0, -2);
    R.num('B', B, 0, -3);
    R.num('E', 1, 0, -4.3);
    R.num('F', F, x2, 0);
    R.num('G', G, x2, -1);
    R.num('H', H, x2, -2.3);
    R.num('K', K, x2, -3.3);
    R.num('L', L, x2, -4.3);
    R.num('M', A, 0, -5.6);
    R.num('N', C, 0, -6.6);
    R.num('O', D, 0, -7.6);
    R.num('P', B, 0, -8.6);
    g.show('A, C, D, B', list(A, C, D, B));
    g.equal('gcd(A, B)', gcd(A, B), 1);
    g.claim('A, C, D, B in continued proportion', continued([A, C, D, B]));
    g.claim(`1, F, H, A = ${list(1, F, H, A)} in continued proportion`, continued([1, F, H, A]));
    g.claim(`1, G, L, B = ${list(1, G, L, B)} in continued proportion`, continued([1, G, L, B]));
  },
});
