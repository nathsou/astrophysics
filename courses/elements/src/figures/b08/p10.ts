import { figure } from '../../geometry/figure';
import { Nums, continued, list } from './lib';

// C is the unit; C, D, E, A and C, F, G, B are in continued proportion, so D, E, A = d, d², d³
// and F, G, B = f, f², f³. H = D·F, K = D·H, L = F·H.
export default figure({
  caption: 'Between the unit C and A fall D, E, and between C and B fall F, G. With H = D·F, K = D·H and L = F·H, the numbers K, L fall between A and B in continued proportion.',
  build(g) {
    const d = g.param('d', 2, { min: 2, max: 4, label: 'D' });
    const f = g.param('f', 3, { min: 2, max: 5, label: 'F' });
    const [D, E, A] = [d, d * d, d ** 3];
    const [F, G, B] = [f, f * f, f ** 3];
    const H = D * F;
    const K = D * H;
    const L = F * H;
    const R = new Nums(g, '8.10', Math.max(A, B), 6);
    const x2 = 8.2;
    R.num('A', A, 0, 0);
    R.num('K', K, 0, -1);
    R.num('L', L, 0, -2);
    R.num('B', B, 0, -3);
    R.num('C', 1, 0, -4.4);
    R.num('D', D, 0, -5.4);
    R.num('E', E, 0, -6.4);
    R.num('F', F, x2, -4.4);
    R.num('G', G, x2, -5.4);
    R.num('H', H, x2, -6.4);
    g.show('A, K, L, B', list(A, K, L, B));
    g.claim('C, D, E, A in continued proportion', continued([1, D, E, A]));
    g.claim('C, F, G, B in continued proportion', continued([1, F, G, B]));
    g.claim('E : H = H : G', continued([E, H, G]));
    g.claim('A, K, L, B in continued proportion', continued([A, K, L, B]));
  },
});
