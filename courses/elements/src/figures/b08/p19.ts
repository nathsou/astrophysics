import { figure } from '../../geometry/figure';
import { Nums, continued, list, ratio, same } from './lib';

// Similar solid numbers: the sides C, D, E of A are s·(p, q, r), the sides F, G, H of B are
// t·(p, q, r). K = C·D, L = F·G, M = D·F, N = E·M, O = H·M.
export default figure({
  caption: 'A = C·D·E and B = F·G·H are similar solid numbers: C : F = D : G = E : H. K, L are the planes C·D and F·G, M = D·F the mean between them, and N = E·M, O = H·M the two means between A and B.',
  build(g) {
    const s = g.param('s', 2, { min: 2, max: 3, label: 'scale of A' });
    const t = g.param('t', 3, { min: 2, max: 3, label: 'scale of B' });
    const p = g.param('p', 1, { min: 1, max: 2, label: 'shape p' });
    const q = g.param('q', 2, { min: 1, max: 2, label: 'shape q' });
    const r = g.param('r', 1, { min: 1, max: 2, label: 'shape r' });
    const [C, D, E] = [s * p, s * q, s * r];
    const [F, G, H] = [t * p, t * q, t * r];
    const [A, B] = [C * D * E, F * G * H];
    const [K, L, M] = [C * D, F * G, D * F];
    const [N, O] = [E * M, H * M];
    const R = new Nums(g, '8.19', Math.max(A, B), 7.5);
    const x2 = 6.2;
    R.num('A', A, 0, 0);
    R.num('N', N, 0, -1);
    R.num('O', O, 0, -2);
    R.num('B', B, 0, -3);
    R.num('K', K, 0, -4.4);
    R.num('M', M, 0, -5.4);
    R.num('L', L, 0, -6.4);
    R.num('C', C, x2, -4.4);
    R.num('D', D, x2, -5.4);
    R.num('E', E, x2, -6.4);
    R.num('F', F, x2 + 2.6, -4.4);
    R.num('G', G, x2 + 2.6, -5.4);
    R.num('H', H, x2 + 2.6, -6.4);
    g.show('A, N, O, B', list(A, N, O, B));
    g.show('K, M, L', list(K, M, L));
    g.claim('C : F = D : G = E : H (similar)', same(C, F, D, G) && same(D, G, E, H));
    g.claim('K, M, L in continued proportion, ratio C : F', continued([K, M, L]) && same(K, M, C, F));
    g.claim(`A, N, O, B in continued proportion, ratio ${ratio(C, F)}`, continued([A, N, O, B]) && same(A, N, C, F));
    g.claim(`A : B = C³ : F³ = ${ratio(A, B)}`, same(A, B, C ** 3, F ** 3));
  },
});
