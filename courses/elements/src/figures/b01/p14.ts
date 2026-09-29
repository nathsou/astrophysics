import { figure } from '../../geometry/figure';
import { add, angle, collinear, deg, dist, mul, rotAbout, sub } from '../../geometry/vec';

// I.14: D glides on CB produced, so the angles ABC, ABD always make two right angles, and the
// conclusion is that CBD is straight. BE is the other line of the reductio, drawn dashed: the
// supposed "true" continuation of CB when BD is supposed not to be one.
export default figure({
  build(g) {
    const A = g.free('A', -0.4, 1.8);
    const B = g.free('B', 0, 0);
    const C = g.free('C', -2.2, 0.2);
    const D = g.glider('D', [B, add(B, mul(sub(B, C), 1.4))], 0.75);
    const E = g.point('E', rotAbout(D, B, 0.2));
    g.path(C, B, D);
    g.segment(B, A);
    g.segment(B, E, { dashed: true });
    g.equal('∠ABC + ∠ABD = 180°', deg(angle(A, B, C) + angle(A, B, D)), 180);
    g.claim('C, B, D are collinear', collinear(C, B, D) && dist(C, D) > dist(C, B));
  },
});
