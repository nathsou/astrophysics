import { figure } from '../../geometry/figure';
import { Nums, continued, list, ratio, same } from './lib';

// A = C³, B = D³; E = C², F = C·D, G = D²; H = C·F, K = D·F.
export default figure({
  caption: 'A, B are the cubes of C, D. With E = C², F = C·D, G = D², H = C·F and K = D·F, the numbers A, H, K, B are in continued proportion in the ratio C : D.',
  build(g) {
    const c = g.param('c', 2, { min: 2, max: 4, label: 'C' });
    const d = g.param('d', 3, { min: 2, max: 5, label: 'D' });
    const [E, F, G] = [c * c, c * d, d * d];
    const [A, H, K, B] = [c * E, c * F, d * F, d * G];
    const R = new Nums(g, '8.12', Math.max(A, B), 8);
    const x2 = 6.5;
    R.num('A', A, 0, 0);
    R.num('H', H, 0, -1);
    R.num('K', K, 0, -2);
    R.num('B', B, 0, -3);
    R.num('C', c, 0, -4.4);
    R.num('D', d, 0, -5.4);
    R.num('E', E, x2 - 2.5, -4.4);
    R.num('F', F, x2 - 2.5, -5.4);
    R.num('G', G, x2 - 2.5, -6.4);
    g.show('A, H, K, B', list(A, H, K, B));
    g.show('E, F, G', list(E, F, G));
    g.claim(`A : H = H : K = K : B = C : D = ${ratio(c, d)}`, continued([A, H, K, B]) && same(A, H, c, d));
    g.claim(`A : B = C³ : D³ = ${ratio(A, B)}`, same(A, B, c ** 3, d ** 3));
  },
});
