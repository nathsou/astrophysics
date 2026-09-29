import { figure } from '../../geometry/figure';
import { add, along, angle, deg, dist, sub } from '../../geometry/vec';

// I.17: any two angles of a triangle are less than two right angles.
export default figure({
  build(g) {
    const A = g.free('A', -0.6, 1.6);
    const B = g.free('B', -2, -0.5);
    const C = g.free('C', 1.2, -0.5);
    const D = g.point('D', along(C, add(C, sub(C, B)), 0.6 * dist(B, C)));
    g.polygon([A, B, C]);
    g.segment(C, D);
    g.angle(A, C, D);
    g.angle(A, B, C);
    const a = deg(angle(B, A, C));
    const b = deg(angle(A, B, C));
    const c = deg(angle(A, C, B));
    g.claim('∠ABC + ∠BCA < 180°', b + c < 180);
    g.claim('∠BAC + ∠ACB < 180°', a + c < 180);
    g.claim('∠CAB + ∠ABC < 180°', a + b < 180);
    g.equal('∠ACD + ∠ACB = 180°', deg(angle(A, C, D)) + c, 180);
  },
});
