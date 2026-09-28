import { figure } from '../../geometry/figure';
import { add, along, dist, lc, perp, sub, v } from '../../geometry/vec';
import { degAt, need, onC } from './lib';

// To draw a tangent from a point A to the circle BCD (centre E): draw the circle AFG about E through
// A, erect DF perpendicular to EA at D, and join EF, cutting BCD at B. Then AB touches BCD.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const r = 1.3;
    const k = g.circle(E, r);
    const A = g.free('A', 3.1, 1.0);
    need(dist(A, E) > r * 1.15, 'A outside the circle');
    const big = g.circle(E, A, { aux: true });
    const D = g.point('D', along(E, A, r));
    const F = g.point('F', lc(D, add(D, perp(sub(A, E))), big)[1]);
    const B = g.point('B', along(E, F, r));
    g.point('C', onC(k, Math.atan2(A.y, A.x) + 2.4));
    g.point('G', onC(big, Math.atan2(A.y, A.x) - 1.7));
    g.segment(E, A);
    g.segment(D, F);
    g.segment(E, F);
    g.segment(A, B, { colour: 'red' });
    g.angle(E, D, F, { right: true });
    g.equal('∠EBA = 90°', degAt(E, B, A), 90);
    g.equal('DF = AB', dist(D, F), dist(A, B));
  },
});
