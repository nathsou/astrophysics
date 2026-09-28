import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// A : B = C : D = m : n; E = A·D, F = B·C, G = A·C.
export default figure({
  caption: 'A : B = C : D. The product E of the extremes A, D equals the product F of the means B, C; G is the auxiliary product of A and C.',
  build(g) {
    const m = g.param('m', 2, { min: 2, max: 3, label: 'm' });
    const n = g.param('n', 3, { min: 2, max: 4, label: 'n' });
    const s = g.param('s', 1, { min: 1, max: 3, label: 's' });
    const t = g.param('t', 2, { min: 1, max: 3, label: 't' });
    const A = m * s;
    const B = n * s;
    const C = m * t;
    const D = n * t;
    const E = A * D;
    const F = B * C;
    const G = A * C;
    const R = new Rods(g, Math.max(E, F, G));
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('C', C, 0, -2.4);
    R.num('D', D, 0, -3.6);
    R.num('E', E, 0, -5);
    R.num('F', F, 0, -6.2);
    R.num('G', G, 0, -7.4);
    g.show('A : B = C : D', ratio(A, B));
    g.show('G : E, G : F', `${ratio(G, E)}, ${ratio(G, F)}`);
    g.equal('E = F', E, F);
  },
});
