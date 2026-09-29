import { figure } from '../../geometry/figure';
import { Nums, continued, isCube, list, primeToOther, root } from './lib';

// A, B, C, D = n³·(d³, d²e, de², e³): A is a cube for every slider value.
export default figure({
  caption: 'A, B, C, D are in continued proportion and A is a cube. Then D is a cube too.',
  build(g) {
    const d = g.param('d', 2, { min: 2, max: 3, label: 'ratio d' });
    const e = primeToOther(d, g.param('e', 3, { min: 2, max: 4, label: 'ratio e' }));
    const n = g.param('n', 1, { min: 1, max: 2, label: 'multiple n' });
    const c = n ** 3;
    const xs = [c * d ** 3, c * d * d * e, c * d * e * e, c * e ** 3];
    const R = new Nums(g, '8.23', Math.max(...xs), 9);
    (['A', 'B', 'C', 'D'] as const).forEach((l, i) => R.num(l, xs[i], 0, -i));
    const [A, , , D] = xs;
    g.show('A, B, C, D', list(...xs));
    g.show('∛A, ∛D', list(root(A, 3), root(D, 3)));
    g.claim('A, B, C, D in continued proportion', continued(xs));
    g.claim('A is a cube', isCube(A));
    g.claim('D is a cube', isCube(D));
  },
});
