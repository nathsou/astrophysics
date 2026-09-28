import { figure } from '../../geometry/figure';
import { Nums, divides, gcdAll, lcm, list, primeToOther, same } from './lib';

// Three ratios A : B, C : D, E : F, each in least numbers. G = lcm(B, C), H, K the numbers in the
// ratios A : B and C : D with it. If E measures K, L completes H, G, K, L (first case). Otherwise
// M = lcm(E, K) and N, O, M, P are the answer (second case). The figure draws the second case by
// default; the first case is the one where N, O, M, P coincide with H, G, K, L.
export default figure({
  caption: 'The given ratios A : B, C : D, E : F in least numbers. G is the least number measured by B and C; H, G, K are the least numbers in the ratios A : B, C : D. When E does not measure K, M is the least number measured by E and K, and N, O, M, P is the answer. L (first case) exists only when E measures K; the dashed Q, R, S, T are the smaller numbers of the reductio.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 5, label: 'A' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 5, label: 'B' }));
    const c = g.param('c', 4, { min: 2, max: 5, label: 'C' });
    const d = primeToOther(c, g.param('d', 5, { min: 2, max: 5, label: 'D' }));
    const e = g.param('e', 2, { min: 2, max: 5, label: 'E' });
    const f = primeToOther(e, g.param('f', 3, { min: 2, max: 5, label: 'F' }));
    const G = lcm(b, c);
    const H = (a * G) / b;
    const K = (d * G) / c;
    const case1 = divides(e, K);
    const L = (f * K) / e;
    const M = lcm(e, K);
    const N = (H * M) / K;
    const O = (G * M) / K;
    const P = (f * M) / e;
    const R = new Nums(g, '8.4', Math.max(H, G, K, L, N, O, M, P), 5.2);
    const x2 = 7.4;
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -0.9);
    R.num('C', c, 0, -1.8);
    R.num('D', d, 0, -2.7);
    R.num('E', e, 0, -3.6);
    R.num('F', f, 0, -4.5);
    R.num('H', H, 0, -5.8);
    R.num('G', G, 0, -6.7);
    R.num('K', K, 0, -7.6);
    R.num('L', L, 0, -8.5, case1 ? {} : { dashed: true, ticks: false, value: `(${f}·${K})/${e}` });
    R.num('N', N, x2, 0);
    R.num('O', O, x2, -0.9);
    R.num('M', M, x2, -1.8);
    R.num('P', P, x2, -2.7);
    const smaller = [N, O, M, P].map((x) => 0.7 * x);
    (['Q', 'R', 'S', 'T'] as const).forEach((n, i) => R.num(n, smaller[i], x2, -4.2 - 0.9 * i, { dashed: true, ticks: false, value: '?' }));
    g.show('case', case1 ? 'E measures K (first case)' : 'E does not measure K (second case)');
    g.show('H, G, K', list(H, G, K));
    g.show('N, O, M, P', list(N, O, M, P));
    g.claim('H : G = A : B and G : K = C : D', same(H, G, a, b) && same(G, K, c, d));
    g.claim('N : O = A : B', same(N, O, a, b));
    g.claim('O : M = C : D', same(O, M, c, d));
    g.claim('M : P = E : F', same(M, P, e, f));
    g.equal('gcd(N, O, M, P) = 1 (least)', gcdAll(N, O, M, P), 1);
    g.claim('first case: N, O, M, P = H, G, K, L', !case1 || (N === H && O === G && M === K && P === L));
  },
});
