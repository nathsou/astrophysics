import { figure } from '../../geometry/figure';
import { Nums, divides, yn } from './lib';

// A = C³, B = D³. Default: 64 and 216.
export default figure({
  caption: 'A, B are the cubes of C, D. A fails to measure B exactly when C fails to measure D.',
  build(g) {
    const c = g.param('c', 4, { min: 2, max: 5, label: 'C' });
    const d = g.param('d', 6, { min: 2, max: 7, label: 'D' });
    const [A, B] = [c ** 3, d ** 3];
    const R = new Nums(g, '8.17', Math.max(A, B), 9);
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
