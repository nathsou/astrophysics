import { figure } from '../../geometry/figure';
import { add, along, angle, deg, dist, mid, mul, perp, sub } from '../../geometry/vec';

// I.6: A glides on the line through the midpoint of BC at right angles to it, so the angles ABC
// and ACB stay equal. D is the point of the reductio: it would cut DB = AC off AB if AB were
// greater, so it is drawn dashed, where it would have to be.
export default figure({
  build(g) {
    const B = g.free('B', -1.4, 0);
    const C = g.free('C', 1.4, 0);
    const M = mid(B, C);
    const A = g.glider('A', [M, add(M, mul(perp(sub(C, B)), 1.2))], 0.75, { line: true });
    g.polygon([A, B, C]);
    const D = g.point('D', along(B, A, 0.72 * dist(B, A)));
    g.segment(D, C, { dashed: true });
    g.angle(A, B, C);
    g.angle(A, C, B);
    g.equal('∠ABC = ∠ACB', deg(angle(A, B, C)), deg(angle(A, C, B)));
    g.equal('AB = AC', dist(A, B), dist(A, C));
  },
});
