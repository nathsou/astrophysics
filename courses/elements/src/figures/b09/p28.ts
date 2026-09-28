import { figure } from '../../geometry/figure';
import { Rods, isEven, isOdd } from './lib';

// A odd, B even; C = A·B is A copies of B.
export default figure({
  caption: 'The odd number A times the even number B is C: as many copies of B as there are units in A (marked on C). A sum of even numbers is even.',
  build(g) {
    const m = g.param('m', 1, { min: 1, max: 3, label: 'A = 2m + 1' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'B ÷ 2' });
    const a = 2 * m + 1;
    const b = 2 * n;
    const c = a * b;
    const R = new Rods(g, c);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.groups(0, -2.4, b, a);
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.claim('A odd, B even', isOdd(a) && isEven(b));
    g.claim('C is even', isEven(c));
  },
});
