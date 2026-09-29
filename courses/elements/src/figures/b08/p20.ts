import { figure } from '../../geometry/figure';
import { Nums, continued, list, primeToOther, same } from './lib';

// A, C, B in continued proportion: A, C, B = m·d², m·de, m·e² with d, e prime to one another.
// D, E = d, e are the least in the ratio A : C; F = A ÷ D, G = B ÷ E.
export default figure({
  caption: 'C is a mean proportional between A and B. D, E are the least numbers in the ratio A : C; then A = D·F and B = E·G with D : F = E : G, so A and B are similar plane numbers.',
  build(g) {
    const d = g.param('d', 2, { min: 2, max: 4, label: 'D' });
    const e = primeToOther(d, g.param('e', 3, { min: 2, max: 5, label: 'E' }));
    const m = g.param('m', 2, { min: 1, max: 3, label: 'multiple m' });
    const [A, C, B] = [m * d * d, m * d * e, m * e * e];
    const [F, G] = [A / d, B / e];
    const R = new Nums(g, '8.20', Math.max(A, B), 8);
    R.num('A', A, 0, 0);
    R.groups(0, 0, d, F);
    R.num('C', C, 0, -1);
    R.num('B', B, 0, -2);
    R.groups(0, -2, e, G);
    R.num('D', d, 0, -3.4);
    R.num('E', e, 0, -4.4);
    R.num('F', F, 4.5, -3.4);
    R.num('G', G, 4.5, -4.4);
    g.show('A, C, B', list(A, C, B));
    g.claim('A, C, B in continued proportion', continued([A, C, B]));
    g.claim('A = D·F and B = E·G', A === d * F && B === e * G);
    g.claim('D : F = E : G (similar)', same(d, F, e, G));
  },
});
