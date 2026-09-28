import { figure } from '../../geometry/figure';
import { add, along, dist, lerp, mul, perp, sub, unit, v } from '../../geometry/vec';
import { degAt, onC } from './lib';

// The radius to the point of contact is perpendicular to the tangent. G is a would-be foot of the
// perpendicular from F to DE other than C (drag it along the tangent): FG always exceeds the radius FB.
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const k = g.circle(F, 2);
    const C = g.glider('C', k, (-100 * Math.PI) / 180);
    const t = unit(perp(sub(C, F)));
    const D = g.point('D', add(C, mul(t, -2.2)));
    const E = g.point('E', add(C, mul(t, 2.6)));
    const G = g.glider('G', [lerp(C, E, 0.15), E], 0.45);
    const B = g.point('B', along(F, G, 2));
    g.point('A', onC(k, (140 * Math.PI) / 180));
    g.segment(D, E);
    g.segment(F, C);
    g.segment(F, G, { dashed: true });
    g.angle(F, C, E, { right: true });
    g.equal('∠FCE = 90°', degAt(F, C, E), 90);
    g.claim('FG > FB: G is outside the circle', dist(F, G) > dist(F, B));
    void D;
  },
});
