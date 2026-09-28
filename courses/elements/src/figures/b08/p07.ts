import { figure } from '../../geometry/figure';
import { Nums, continued, divides, list } from './lib';

// A measures D: then the common ratio is 1 : r, so A, B, C, D = k, kr, kr², kr³.
export default figure({
  caption: 'A, B, C, D are in continued proportion and A measures D. Then A measures B: the ratio is that of the unit to a number.',
  build(g) {
    const k = g.param('k', 2, { min: 2, max: 4, label: 'A' });
    const r = g.param('r', 3, { min: 2, max: 3, label: 'ratio 1 : r' });
    const xs = [k, k * r, k * r * r, k * r ** 3];
    const [A, B, , D] = xs;
    const R = new Nums(g, '8.7', D, 9);
    (['A', 'B', 'C', 'D'] as const).forEach((n, i) => R.num(n, xs[i], 0, -i));
    R.groups(0, -3, A, D / A);
    R.groups(0, -1, A, B / A);
    g.show('A, B, C, D', list(...xs));
    g.claim('in continued proportion', continued(xs));
    g.claim('A measures D', divides(A, D));
    g.claim('A measures B', divides(A, B));
  },
});
