import { figure } from '../../geometry/figure';
import { add, cc, dist, mid, mul, perp, sub, unit } from '../../geometry/vec';
import { Degenerate } from '../../geometry/vec';

// Fitting a chord of given length D into the circle ABC: cut CE = D off the diameter CB, and the
// circle with centre C through E meets the given circle at A.
export default figure({
  build(g) {
    const d = g.param('d', 2.6, { min: 0.3, max: 4, label: 'D' });
    const B = g.free('B', -2, 0);
    const C = g.free('C', 2, 0);
    const O = mid(B, C);
    const r = dist(O, B);
    if (d > 2 * r) throw new Degenerate('D is greater than the diameter');
    const k = g.circle(O, B);
    const u = unit(sub(C, B));
    const up = perp(u);
    // the given straight line D, set out above the circle
    const d0 = add(O, add(mul(up, r + 0.6), mul(u, -d / 2)));
    const d1 = add(d0, mul(u, d));
    g.segment(d0, d1, { name: 'D' });
    g.text(add(d0, add(mul(u, -0.35), mul(up, -0.1))), 'D');
    g.segment(B, C);
    const E = g.point('E', add(C, mul(u, -d)));
    const k2 = g.circle(C, E, { aux: true });
    const [A, F] = cc(k, k2);
    g.point('A', A);
    g.point('F', F);
    g.segment(C, A);
    g.equal('CA = D', dist(C, A), d);
    g.equal('CE = D', dist(C, E), d);
  },
});
