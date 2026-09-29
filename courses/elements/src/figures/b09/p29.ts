import { figure } from '../../geometry/figure';
import { Rods, isOdd } from './lib';

// A, B odd; C = A·B is A copies of B.
export default figure({
  caption: 'The odd number A times the odd number B is C: an odd multitude of copies of the odd number B (marked on C). So C is odd (IX.23).',
  build(g) {
    const m = g.param('m', 1, { min: 1, max: 3, label: 'A = 2m + 1' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'B = 2n + 1' });
    const a = 2 * m + 1;
    const b = 2 * n + 1;
    const c = a * b;
    const R = new Rods(g, c);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.groups(0, -2.4, b, a);
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.claim('A, B odd', isOdd(a) && isOdd(b));
    g.claim('C is odd', isOdd(c));
  },
});
