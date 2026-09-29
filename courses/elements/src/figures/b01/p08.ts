import { figure } from '../../geometry/figure';
import { angle, cc, deg, dist, rotAbout, side } from '../../geometry/vec';

// I.8 (SSS): F glides on the circle about E with radius BC, and D is where the circles of radii BA
// about E and CA about F meet, on the same side of EF as A is of BC. G is the other apex that the
// reductio supposes, drawn dashed: it cannot have GE = BA and GF = CA at once (I.7).
export default figure({
  build(g) {
    const A = g.free('A', -2.6, 1.4);
    const B = g.free('B', -3.4, -0.6);
    const C = g.free('C', -0.9, -0.6);
    const E = g.free('E', 0.9, -0.6);
    const F = g.glider('F', { c: E, r: dist(B, C) }, Math.atan2(C.y - B.y, C.x - B.x));
    const [l, r] = cc({ c: E, r: dist(B, A) }, { c: F, r: dist(C, A) });
    const D = g.point('D', side(B, C, A) > 0 ? l : r);
    g.polygon([A, B, C]);
    g.polygon([D, E, F]);
    const G = g.point('G', rotAbout(D, E, side(B, C, A) > 0 ? -0.28 : 0.28));
    g.path(E, G, F, { dashed: true });
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('∠BAC = ∠EDF', deg(angle(B, A, C)), deg(angle(E, D, F)));
  },
});
