import { figure } from '../../geometry/figure';
import { Rods, divides, isEven, isOdd } from './lib';

// A odd measures B even according to C; C must be even, so A measures B / 2.
export default figure({
  caption: 'The odd number A measures the even number B, C times (the copies of A are marked on B). C cannot be odd, since then B would be odd; so C is even, and A measures the half of B.',
  build(g) {
    const m = g.param('m', 1, { min: 1, max: 3, label: 'A = 2m + 1' });
    const n = g.param('n', 2, { min: 1, max: 3, label: 'C ÷ 2' });
    const a = 2 * m + 1;
    const c = 2 * n;
    const b = a * c;
    const R = new Rods(g, b);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.groups(0, -1.2, a, c);
    R.num('C', c, 0, -2.4);
    R.bare(b / 2, 0, -3.6, '½ B', { aux: true });
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.claim('A odd measures B even', isOdd(a) && isEven(b) && divides(a, b));
    g.claim('C is even', isEven(c));
    g.claim('A measures the half of B', divides(a, b / 2));
  },
});
