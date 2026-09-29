import { figure } from '../../geometry/figure';
import { Nums, divides, yn } from './lib';

// A = C², B = D². Default: 16 and 36, whose sides 4 and 6 do not measure one another.
export default figure({
  caption: 'A, B are the squares of C, D. A fails to measure B exactly when C fails to measure D. The default 16, 36 have a large common factor, and still neither measures the other.',
  build(g) {
    const c = g.param('c', 4, { min: 2, max: 6, label: 'C' });
    const d = g.param('d', 6, { min: 2, max: 10, label: 'D' });
    const [A, B] = [c * c, d * d];
    const R = new Nums(g, '8.16', Math.max(A, B), 9);
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1);
    R.groups(0, -1, A, Math.floor(B / A) + 1);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.4);
    R.groups(0, -3.4, c, Math.floor(d / c) + 1);
    g.show('A measures B', yn(divides(A, B)));
    g.show('C measures D', yn(divides(c, d)));
    g.claim('A does not measure B ⇔ C does not measure D', !divides(A, B) === !divides(c, d));
  },
});
