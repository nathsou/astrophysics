import { figure } from '../../geometry/figure';
import { Rods, divides, gcd, primeTo } from './lib';

// A, B prime to one another; the dashed C = B²/A, which is not a number.
export default figure({
  caption: 'A and B are prime to one another. The dashed C is the third proportional the reductio supposes, B·B / A: it is never a whole number.',
  build(g) {
    const a = g.param('a', 4, { min: 2, max: 7, label: 'A' });
    const b0 = g.param('b', 5, { min: 2, max: 9, label: 'B' });
    const b = primeTo(a, b0);
    const c = (b * b) / a;
    const R = new Rods(g, Math.max(a, b, c));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4, { dashed: true, ticks: false });
    g.show('B·B / A', c.toFixed(2));
    g.equal('gcd(A, B) = 1', gcd(a, b), 1);
    g.claim('A does not measure B·B: no C with A : B = B : C', !divides(a, b * b));
  },
});
