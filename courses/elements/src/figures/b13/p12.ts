import { figure } from '../../geometry/figure';
import { dist, mul, regular, sub, v } from '../../geometry/vec';

// The equilateral triangle ABC in the circle with centre D; AD is carried through to E, and BE,
// which subtends a sixth of the circle, is joined.
export default figure({
  build(g) {
    const D = g.point('D', v(0, 0));
    const k = g.circle(D, 2);
    const A = g.glider('A', k, Math.PI / 2);
    const [, B, C] = regular(D, 2, 3, Math.atan2(A.y, A.x));
    const P = g.points({ B, C });
    const E = g.point('E', sub(mul(D, 2), A));
    g.polygon([A, P.B, P.C], { fill: true });
    g.segment(A, E, { aux: true });
    g.segment(P.B, E);
    g.equal('BE = DE (side of the hexagon)', dist(P.B, E), dist(D, E));
    g.equal('□AE = □AB + □BE', dist(A, E) ** 2, dist(A, P.B) ** 2 + dist(P.B, E) ** 2);
    g.equal('□AB = 3 □DE', dist(A, P.B) ** 2, 3 * dist(D, E) ** 2);
  },
});
