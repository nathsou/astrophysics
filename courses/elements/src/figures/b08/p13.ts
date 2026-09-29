import { figure } from '../../geometry/figure';
import { Nums, continued, list, primeToOther, progression } from './lib';

// A, B, C = k·a², k·ab, k·b². D, E, F their squares, G, H, K their cubes. L = A·B, M = A·L,
// N = B·L; O = B·C, P = B·O, Q = C·O. Squares and cubes grow fast, so each group has its own scale.
export default figure({
  caption: 'A, B, C are in continued proportion; D, E, F are their squares and G, H, K their cubes. L, M, N and O, P, Q are the auxiliary products. The three groups are drawn to different scales.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 3, label: 'ratio a' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 4, label: 'ratio b' }));
    const k = g.param('k', 1, { min: 1, max: 2, label: 'multiple k' });
    const [A, B, C] = progression(k, a, b, 3);
    const [D, E, F] = [A * A, B * B, C * C];
    const [G, H, K] = [A * D, B * E, C * F];
    const L = A * B;
    const [M, N] = [A * L, B * L];
    const O = B * C;
    const [P, Q] = [B * O, C * O];
    const R1 = new Nums(g, '8.13', Math.max(A, C), 3);
    R1.num('A', A, 0, 0);
    R1.num('B', B, 0, -1);
    R1.num('C', C, 0, -2);
    const R2 = new Nums(g, '8.13', Math.max(D, F), 3);
    const x2 = 5.8;
    R2.num('D', D, x2, 0);
    R2.num('L', L, x2, -1);
    R2.num('E', E, x2, -2);
    R2.num('O', O, x2, -3);
    R2.num('F', F, x2, -4);
    const R3 = new Nums(g, '8.13', Math.max(G, K), 8.8);
    const y3 = -5.5;
    (['G', 'M', 'N', 'H', 'P', 'Q', 'K'] as const).forEach((n, i) => R3.num(n, [G, M, N, H, P, Q, K][i], 0, y3 - i));
    g.show('A, B, C', list(A, B, C));
    g.show('D, E, F', list(D, E, F));
    g.show('G, H, K', list(G, H, K));
    g.claim('A, B, C in continued proportion', continued([A, B, C]));
    g.claim('D, L, E and E, O, F in continued proportion', continued([D, L, E]) && continued([E, O, F]));
    g.claim('G, M, N, H and H, P, Q, K in continued proportion', continued([G, M, N, H]) && continued([H, P, Q, K]));
    g.claim('D, E, F in continued proportion', continued([D, E, F]));
    g.claim('G, H, K in continued proportion', continued([G, H, K]));
  },
});
