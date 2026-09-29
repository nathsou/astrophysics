import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo } from './lib';

export default figure({
  caption: 'AB and BC are prime to one another, and AC is their sum. The dashed D is the supposed common measure.',
  build(g) {
    const ab = g.param('ab', 5, { min: 2, max: 9, label: 'AB' });
    const bc0 = g.param('bc', 8, { min: 2, max: 11, label: 'BC' });
    const bc = primeTo(ab, bc0);
    const R = new Rods(g, ab + bc);
    R.seg('A', 'C', ab + bc, 0, 0);
    R.mark('B', 0, 0, ab);
    R.num('D', 2, 0, -1.4, { dashed: true });
    g.equal('gcd(AB, BC) = 1', gcd(ab, bc), 1);
    g.equal('gcd(AC, AB) = 1', gcd(ab + bc, ab), 1);
    g.equal('gcd(AC, BC) = 1', gcd(ab + bc, bc), 1);
  },
});
