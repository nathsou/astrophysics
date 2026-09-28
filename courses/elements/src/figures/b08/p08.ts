import { figure } from '../../geometry/figure';
import { Nums, continued, gcd, list, primeToOther, progression, same } from './lib';

// A, C, D, B = k·(a³, a²b, ab², b³): two means between A and B. E : F = A : B, so E = m·a³ and
// F = m·b³. G, H, K, L = a³, a²b, ab², b³ (least), and M, N = m·a²b, m·ab².
export default figure({
  caption: 'C, D fall between A, B in continued proportion, and E : F = A : B. G, H, K, L are the least numbers in the ratio of A, C, D, B; G measures E as often as L measures F, and the same multiples M, N of H, K fall between E and F.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 3, label: 'ratio a' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 4, label: 'ratio b' }));
    const k = g.param('k', 2, { min: 1, max: 3, label: 'A = k·G' });
    const m = g.param('m', 3, { min: 1, max: 3, label: 'E = m·G' });
    const [G, H, K, L] = progression(1, a, b, 4);
    const [A, C, D, B] = progression(k, a, b, 4);
    const [E, M, N, F] = progression(m, a, b, 4);
    const R = new Nums(g, '8.8', Math.max(A, B, E, F, G, L), 6);
    const x2 = 8.4;
    R.num('A', A, 0, 0);
    R.num('C', C, 0, -1);
    R.num('D', D, 0, -2);
    R.num('B', B, 0, -3);
    R.num('E', E, x2, 0);
    R.num('M', M, x2, -1);
    R.num('N', N, x2, -2);
    R.num('F', F, x2, -3);
    R.num('G', G, 0, -4.4);
    R.num('H', H, 0, -5.4);
    R.num('K', K, 0, -6.4);
    R.num('L', L, 0, -7.4);
    g.show('A, C, D, B', list(A, C, D, B));
    g.show('E, M, N, F', list(E, M, N, F));
    g.claim('A, C, D, B in continued proportion', continued([A, C, D, B]));
    g.claim('E : F = A : B', same(E, F, A, B));
    g.equal('gcd(G, L)', gcd(G, L), 1);
    g.equal('E ÷ G = F ÷ L', E / G, F / L);
    g.claim('E, M, N, F in continued proportion', continued([E, M, N, F]));
  },
});
