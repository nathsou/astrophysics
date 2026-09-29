import { figure } from '../../geometry/figure';
import { Nums, continued, gcd, gcdAll, list, primeToOther, progression, ratio } from './lib';

// A, B, C, D are least in their ratio: they are a³, a²b, ab², b³ with a, b prime to one another.
// E, F; G, H, K; L, M, N, O are the least two, three and four numbers in that ratio (VIII.2).
export default figure({
  caption: 'A, B, C, D are the least numbers in continued proportion in their ratio. E, F, then G, H, K, then L, M, N, O are the least two, three and four numbers in the same ratio, built as in VIII.2; L, M, N, O turn out to be A, B, C, D themselves.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 4, label: 'ratio a' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 5, label: 'ratio b' }));
    const [A, B, C, D] = progression(1, a, b, 4);
    const [E, F] = [a, b];
    const [G, H, K] = progression(1, a, b, 3);
    const [L, M, N, O] = progression(1, a, b, 4);
    const R = new Nums(g, '8.3', Math.max(A, D), 5);
    const x2 = 7;
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1);
    R.num('C', C, 0, -2);
    R.num('D', D, 0, -3);
    R.num('E', E, x2, 0);
    R.num('F', F, x2, -1);
    R.num('G', G, x2, -2.3);
    R.num('H', H, x2, -3.3);
    R.num('K', K, x2, -4.3);
    R.num('L', L, 0, -4.6);
    R.num('M', M, 0, -5.6);
    R.num('N', N, 0, -6.6);
    R.num('O', O, 0, -7.6);
    g.show('A, B, C, D', list(A, B, C, D));
    g.show('common ratio', ratio(A, B));
    g.claim('A, B, C, D in continued proportion', continued([A, B, C, D]));
    g.equal('gcd(A, B, C, D) = 1 (least)', gcdAll(A, B, C, D), 1);
    g.equal('gcd(E, F)', gcd(E, F), 1);
    g.claim('L = A and O = D', L === A && O === D);
    g.equal('gcd(A, D)', gcd(A, D), 1);
  },
});
