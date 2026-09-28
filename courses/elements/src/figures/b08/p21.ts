import { figure } from '../../geometry/figure';
import { Nums, continued, list, primeToOther, same } from './lib';

// A, C, D, B = m·(x³, x²y, xy², y³). E, F, G = x², xy, y² (least); E = H·K and G = L·M with
// H = K = x and L = M = y (the sides VIII.20 gives); N = A ÷ E and O = C ÷ E.
export default figure({
  caption: 'C, D are two means between A and B. E, F, G are the least numbers in the ratio of A, C, D; E = H·K and G = L·M are similar plane numbers, and A = H·K·N, B = L·M·O are similar solid numbers.',
  build(g) {
    const x = g.param('x', 2, { min: 2, max: 3, label: 'ratio x' });
    const y = primeToOther(x, g.param('y', 3, { min: 2, max: 4, label: 'ratio y' }));
    const m = g.param('m', 2, { min: 1, max: 3, label: 'multiple m' });
    const [A, C, D, B] = [m * x ** 3, m * x * x * y, m * x * y * y, m * y ** 3];
    const [E, F, G] = [x * x, x * y, y * y];
    const [H, K, L, M] = [x, x, y, y];
    const [N, O] = [A / E, C / E];
    const R = new Nums(g, '8.21', Math.max(A, B), 8);
    R.num('A', A, 0, 0);
    R.num('C', C, 0, -1);
    R.num('D', D, 0, -2);
    R.num('B', B, 0, -3);
    R.num('E', E, 0, -4.4);
    R.num('F', F, 0, -5.4);
    R.num('G', G, 0, -6.4);
    const x2 = 4.4;
    R.num('H', H, x2, -4.4);
    R.num('K', K, x2, -5.4);
    R.num('N', N, x2, -6.4);
    R.num('L', L, x2 + 2.8, -4.4);
    R.num('M', M, x2 + 2.8, -5.4);
    R.num('O', O, x2 + 2.8, -6.4);
    g.show('A, C, D, B', list(A, C, D, B));
    g.show('sides of A; of B', `${list(H, K, N)}; ${list(L, M, O)}`);
    g.claim('A, C, D, B in continued proportion', continued([A, C, D, B]));
    g.claim('A = H·K·N and B = L·M·O', A === H * K * N && B === L * M * O);
    g.claim('H : L = K : M = N : O (similar)', same(H, L, K, M) && same(K, M, N, O));
  },
});
