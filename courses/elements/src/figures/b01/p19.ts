import { figure } from '../../geometry/figure';
import { Degenerate, angle, dist } from '../../geometry/vec';

// I.19: the converse of I.18. The hypothesis ∠ABC > ∠BCA is enforced (other drags are refused).
export default figure({
  build(g) {
    const A = g.free('A', -0.8, 1.6);
    const B = g.free('B', -1.8, -0.4);
    const C = g.free('C', 1.8, -0.4);
    if (angle(A, B, C) <= angle(B, C, A) * 1.001) throw new Degenerate('the angle ABC must be greater than the angle BCA');
    g.polygon([A, B, C]);
    g.angle(A, B, C);
    g.angle(B, C, A);
    g.claim('AC > AB', dist(A, C) > dist(A, B));
  },
});
