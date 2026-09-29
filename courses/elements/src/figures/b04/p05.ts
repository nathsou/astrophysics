import { figure } from '../../geometry/figure';
import { add, angle, dist, ll, mid, perp, side, sub } from '../../geometry/vec';

// The circumcircle: the perpendicular bisectors of AB and AC meet at F, equidistant from A, B, C.
// Drag A across the circle on BC to pass from Euclid's first case (F inside) to the others.
export default figure({
  build(g) {
    const A = g.free('A', -0.7, 2.3);
    const B = g.free('B', -2.4, -1);
    const C = g.free('C', 2.6, -1);
    const D = g.point('D', mid(A, B));
    const E = g.point('E', mid(A, C));
    const F = g.point('F', ll(D, add(D, perp(sub(B, A))), E, add(E, perp(sub(C, A)))));
    g.polygon([A, B, C]);
    g.segment(D, F);
    g.segment(E, F);
    g.segment(F, A, { aux: true });
    g.segment(F, B, { aux: true });
    g.segment(F, C, { aux: true });
    g.angle(A, D, F, { right: true });
    g.angle(A, E, F, { right: true });
    g.circle(F, A);
    g.equal('FA = FB', dist(F, A), dist(F, B));
    g.equal('FB = FC', dist(F, B), dist(F, C));
    const acute = angle(B, A, C) < Math.PI / 2;
    g.claim('∠BAC acute ⇔ F on the same side of BC as A', acute === (side(B, C, F) === side(B, C, A)));
  },
});
