import { figure } from '../../geometry/figure';
import { Degenerate, along, angle, deg, dist } from '../../geometry/vec';

// I.18: AC > AB (dragging so that AC ≤ AB is refused); AD = AB is cut off AC.
export default figure({
  build(g) {
    const A = g.free('A', -0.8, 1.6);
    const B = g.free('B', -1.8, -0.4);
    const C = g.free('C', 1.8, -0.4);
    if (dist(A, C) <= dist(A, B) * 1.001) throw new Degenerate('AC must be greater than AB');
    const D = g.point('D', along(A, C, dist(A, B)));
    g.polygon([A, B, C]);
    g.segment(B, D);
    g.angle(A, B, C);
    g.angle(B, C, A);
    g.equal('∠ADB = ∠ABD', deg(angle(A, D, B)), deg(angle(A, B, D)));
    g.claim('∠ABC > ∠BCA', angle(A, B, C) > angle(B, C, A));
  },
});
