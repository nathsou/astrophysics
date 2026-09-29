import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// A : B = C : D = m : n.
export default figure({
  caption: 'A : B = C : D; then, alternately, A : C = B : D.',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'n' });
    const s = g.param('s', 2, { min: 2, max: 4, label: 's' });
    const t = g.param('t', 3, { min: 2, max: 4, label: 't' });
    const A = m * s;
    const B = n * s;
    const C = m * t;
    const D = n * t;
    const R = new Rods(g, Math.max(A, B, C, D));
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('C', C, 0, -2.4);
    R.num('D', D, 0, -3.6);
    g.show('A : B = C : D', ratio(A, B));
    g.show('A : C', ratio(A, C));
    g.show('B : D', ratio(B, D));
    g.equal('A·D = C·B', A * D, C * B);
  },
});
