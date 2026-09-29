import { figure } from '../../geometry/figure';
import { Rods, evenTimesEven, evenTimesOdd, isOdd } from './lib';

// A = 2·(odd).
export default figure({
  caption: 'A has an odd half. The half measures A twice, an even number of times, so A is even-times odd; and A cannot be even-times even, for then its odd half would be measured by an even number.',
  build(g) {
    const k = g.param('k', 3, { min: 1, max: 7, label: 'half of A = 2k + 1' });
    const h = 2 * k + 1;
    const a = 2 * h;
    const R = new Rods(g, a);
    R.num('A', a, 0, 0);
    R.groups(0, 0, h, 2);
    R.bare(h, 0, -1.2, '½ A', { aux: true });
    g.show('A, half of A', `${a}, ${h}`);
    g.claim('the half of A is odd', isOdd(a / 2));
    g.claim('A is even-times odd', evenTimesOdd(a));
    g.claim('A is not even-times even', !evenTimesEven(a));
  },
});
