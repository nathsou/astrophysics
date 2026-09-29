import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo, smallerPairInRatio } from './lib';

export default figure({
  caption: 'A, B are prime to one another. The dashed C, D (supposed smaller numbers in the same ratio) and E cannot exist.',
  build(g) {
    const a = g.param('a', 5, { min: 2, max: 12, label: 'A' });
    const b0 = g.param('b', 8, { min: 2, max: 14, label: 'B' });
    const b = primeTo(a, b0);
    const R = new Rods(g, Math.max(a, b));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', Math.ceil(a / 2), 0, -2.6, { dashed: true });
    R.num('D', Math.ceil(b / 2), 0, -3.8, { dashed: true });
    R.num('E', 2, 0, -5, { dashed: true });
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
    g.claim('no smaller pair has the ratio A : B', !smallerPairInRatio(a, b));
  },
});
