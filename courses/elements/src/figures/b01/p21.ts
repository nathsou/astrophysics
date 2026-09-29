import { figure } from '../../geometry/figure';
import { Degenerate, angle, dist, ll, side } from '../../geometry/vec';

// I.21: D is any point inside the triangle (dragging it outside is refused); BD produced meets AC at E.
export default figure({
  build(g) {
    const A = g.free('A', -0.3, 2);
    const B = g.free('B', -2, -0.5);
    const C = g.free('C', 2, -0.5);
    const D = g.free('D', 0.1, 0.35);
    const s = side(A, B, C);
    if (!(side(A, B, D) === s && side(B, C, D) === s && side(C, A, D) === s)) throw new Degenerate('D must lie inside the triangle');
    const E = g.point('E', ll(B, D, A, C));
    g.polygon([A, B, C]);
    g.path(B, D, C);
    g.segment(D, E, { aux: true });
    g.angle(B, D, C);
    g.angle(B, A, C);
    g.claim('BD + DC < BA + AC', dist(B, D) + dist(D, C) < dist(B, A) + dist(A, C));
    g.claim('∠BDC > ∠BAC', angle(B, D, C) > angle(B, A, C));
  },
});
