import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo, smallerPairInRatio } from './lib';

export default figure({
  caption: 'A, B are the least numbers in their ratio. The dashed C (a supposed common measure) and the quotients D, E cannot exist.',
  build(g) {
    const a = g.param('a', 4, { min: 2, max: 12, label: 'A' });
    const b0 = g.param('b', 9, { min: 2, max: 14, label: 'B' });
    const b = primeTo(a, b0);
    const R = new Rods(g, Math.max(a, b));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', 2, 0, -2.6, { dashed: true });
    R.num('D', Math.ceil(a / 2), 0, -3.8, { dashed: true });
    R.num('E', Math.ceil(b / 2), 0, -5, { dashed: true });
    g.claim('no smaller pair has the ratio A : B', !smallerPairInRatio(a, b));
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
  },
});
