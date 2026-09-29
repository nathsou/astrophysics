import { figure } from '../../geometry/figure';
import { Rods, gcdAll, primeTo } from './lib';

// A, B, C = D·(E, F, G) with E, F, G having no common measure.
export default figure({
  caption: 'D is the greatest common measure of A, B, C, and E, F, G are the numbers of times it measures them. The dashed H, K, L (smaller numbers in the same ratio) and M (a common measure greater than D) cannot exist.',
  build(g) {
    const d = g.param('d', 3, { min: 2, max: 4, label: 'D' });
    const e = g.param('e', 2, { min: 2, max: 5, label: 'E' });
    const f = g.param('f', 4, { min: 2, max: 5, label: 'F' });
    const g0 = g.param('g', 3, { min: 2, max: 6, label: 'G' });
    const gg = primeTo(e, g0);
    const [A, B, C] = [d * e, d * f, d * gg];
    const R = new Rods(g, Math.max(A, B, C), 6);
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('C', C, 0, -2.4);
    R.num('D', d, 0, -3.6);
    const x2 = 7.5;
    R.num('E', e, x2, 0);
    R.num('F', f, x2, -1.2);
    R.num('G', gg, x2, -2.4);
    R.num('H', Math.max(1, e - 1), x2, -3.8, { dashed: true });
    R.num('K', Math.max(1, f - 1), x2, -5, { dashed: true });
    R.num('L', Math.max(1, gg - 1), x2, -6.2, { dashed: true });
    R.num('M', d + 1, 0, -5, { dashed: true });
    g.show('A, B, C', `${A}, ${B}, ${C}`);
    g.equal('D = gcd(A, B, C)', d, gcdAll(A, B, C));
    g.equal('gcd(E, F, G) = 1', gcdAll(e, f, gg), 1);
    g.claim('E : F : G = A : B : C', A * f === B * e && B * gg === C * f);
  },
});
