import { figure } from '../../geometry/figure';
import { Rods, divides, gcd, gcdAll, primeTo } from './lib';

// The second case of the text: D = gcd(A, B) does not measure C, and E = gcd(D, C).
// A = D·a, B = D·(a + 1), C = E·c with D = E·m and c prime to m, so that D never measures C.
export default figure({
  caption: 'The second case: D, the greatest common measure of A and B, does not measure C, and E is the greatest common measure of D and C. The dashed F is the supposed greater common measure.',
  build(g) {
    const e = g.param('e', 2, { min: 2, max: 3, label: 'E' });
    const m = g.param('m', 3, { min: 2, max: 3, label: 'D ÷ E' });
    const k = g.param('k', 2, { min: 1, max: 3, label: 'A ÷ D' });
    const c0 = g.param('c', 4, { min: 1, max: 6, label: 'C ÷ E' });
    const c = primeTo(m, c0);
    const D = e * m;
    const A = D * k;
    const B = D * (k + 1);
    const C = e * c;
    const R = new Rods(g, Math.max(A, B, C));
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('C', C, 0, -2.4);
    R.num('D', D, 0, -3.6);
    R.num('E', e, 0, -4.8);
    R.num('F', e + 1, 0, -6, { dashed: true });
    g.show('A, B, C', `${A}, ${B}, ${C}`);
    g.equal('D = gcd(A, B)', D, gcd(A, B));
    g.claim('D does not measure C', !divides(D, C));
    g.equal('E = gcd(D, C)', e, gcd(D, C));
    g.equal('E = gcd(A, B, C)', e, gcdAll(A, B, C));
  },
});
