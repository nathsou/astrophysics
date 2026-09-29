import { figure } from '../../geometry/figure';
import { add, angle, deg, dist, mul, rotAbout, sub, unit, v } from '../../geometry/vec';

// In the circle ABC with centre E, BC is the side of the inscribed decagon and CD, in a straight
// line with it, the side of the hexagon (equal to the radius). BE is carried through to A. The
// whole BD is cut in extreme and mean ratio at C, and CD is the greater segment.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 1.8);
    const B = g.glider('B', k, (200 * Math.PI) / 180);
    const C = g.point('C', rotAbout(B, E, (36 * Math.PI) / 180));
    const D = g.point('D', add(C, mul(unit(sub(C, B)), k.r)));
    const A = g.point('A', sub(mul(E, 2), B));
    g.segment(B, D);
    g.segment(B, A, { aux: true });
    g.segment(E, C);
    g.segment(E, D);
    g.equal('CD = radius (side of the hexagon)', dist(C, D), k.r);
    g.equal('∠EDC = ∠BEC', deg(angle(E, D, C)), deg(angle(B, E, C)));
    g.equal('BD : DC = DC : CB', dist(B, D) / dist(D, C), dist(D, C) / dist(C, B));
    g.claim('DC > CB', dist(D, C) > dist(C, B));
  },
});
