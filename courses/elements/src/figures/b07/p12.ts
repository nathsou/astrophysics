import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// A : B = C : D = m : n.
export default figure({
  caption: 'A : B = C : D. The dashed rods are the sums A + C and B + D, which are in the same ratio.',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'n' });
    const s = g.param('s', 2, { min: 2, max: 4, label: 's' });
    const t = g.param('t', 3, { min: 2, max: 4, label: 't' });
    const A = m * s;
    const B = n * s;
    const C = m * t;
    const D = n * t;
    const R = new Rods(g, Math.max(A + C, B + D));
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('C', C, 0, -2.4);
    R.num('D', D, 0, -3.6);
    R.bare(A, 0, -5, undefined, { from: 3 });
    R.bare(C, R.x(A), -5, 'A + C', { dashed: true, from: 3 });
    R.bare(B, 0, -6.2, undefined, { from: 3 });
    R.bare(D, R.x(B), -6.2, 'B + D', { dashed: true, from: 3 });
    g.show('A : B', ratio(A, B));
    g.show('C : D', ratio(C, D));
    g.show('(A + C) : (B + D)', ratio(A + C, B + D));
    g.equal('A·(B + D) = B·(A + C)', A * (B + D), B * (A + C));
  },
});
