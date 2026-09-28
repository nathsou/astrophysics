import { figure } from '../../geometry/figure';
import { add, along, angle, deg, dist, mid, sub } from '../../geometry/vec';

// I.16: E is the midpoint of AC, EF = BE on BE produced, and the angle ECF copies the angle BAE
// inside the exterior angle ACD.
export default figure({
  build(g) {
    const A = g.free('A', -0.9, 1.6);
    const B = g.free('B', -2, -0.6);
    const C = g.free('C', 1, -0.6);
    const D = g.point('D', along(C, add(C, sub(C, B)), 0.8 * dist(B, C)));
    const E = g.point('E', mid(A, C), { labelDir: 80 });
    const F = g.point('F', add(E, sub(E, B)));
    const G = g.point('G', along(C, add(C, sub(C, A)), 0.55 * dist(A, C)));
    g.polygon([A, B, C]);
    g.segment(C, D);
    g.segment(C, G);
    g.segment(B, F);
    g.segment(F, C);
    g.angle(B, A, E);
    g.angle(E, C, F);
    g.equal('∠BAE = ∠ECF', deg(angle(B, A, E)), deg(angle(E, C, F)));
    g.claim('∠ACD > ∠BAC', angle(A, C, D) > angle(B, A, C));
    g.claim('∠ACD > ∠ABC', angle(A, C, D) > angle(A, B, C));
  },
});
