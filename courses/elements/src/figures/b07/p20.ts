import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo, smallerPairInRatio } from './lib';

// CD, EF are prime to one another (so least in their ratio); A, B are k times them.
export default figure({
  caption: 'CD, EF are the least numbers in the ratio of A to B. G and H mark the division of CD and EF into parts of A and B that the reductio supposes, and which cannot happen.',
  build(g) {
    const c = g.param('c', 3, { min: 2, max: 6, label: 'CD' });
    const e0 = g.param('e', 4, { min: 2, max: 7, label: 'EF' });
    const k = g.param('k', 2, { min: 2, max: 3, label: 'k' });
    const e = primeTo(c, e0);
    const A = k * c;
    const B = k * e;
    const R = new Rods(g, Math.max(A, B));
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.seg('C', 'D', c, 0, -2.6);
    R.mark('G', 0, -2.6, c / 2, { hidden: true });
    R.seg('E', 'F', e, 0, -3.8);
    R.mark('H', 0, -3.8, e / 2, { hidden: true });
    g.equal('gcd(CD, EF) = 1', gcd(c, e), 1);
    g.claim('CD, EF least in the ratio A : B', A * e === B * c && !smallerPairInRatio(c, e));
    g.equal('A ÷ CD = B ÷ EF', A / c, B / e);
  },
});
