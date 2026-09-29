import { figure } from '../../geometry/figure';
import { add, angle, deg, dist, mul, perp, side, sub, unit } from '../../geometry/vec';

// I.13: AB stands on CD at B. BE is the perpendicular at B (I.11), on the side of A.
export default figure({
  build(g) {
    const C = g.free('C', -2.2, 0);
    const D = g.free('D', 2.2, 0);
    const B = g.glider('B', [C, D], 0.52);
    const A = g.free('A', -1.1, 1.7);
    const n = perp(unit(sub(D, C)));
    const E = g.point('E', add(B, mul(side(C, D, A) >= 0 ? n : mul(n, -1), 0.9 * dist(B, A))));
    g.segment(C, D);
    g.segment(B, A);
    g.segment(B, E, { aux: true });
    g.angle(E, B, D, { right: true });
    g.equal('∠CBA + ∠ABD = 180°', deg(angle(C, B, A) + angle(A, B, D)), 180);
  },
});
