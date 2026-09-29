import { figure } from '../../geometry/figure';
import { add, along, angle, deg, dist, mul, sub, unit } from '../../geometry/vec';

// I.5 (pons asinorum): C glides on the circle about A through B, so AB = AC always.
export default figure({
  build(g) {
    const A = g.free('A', 0, 2.2);
    const B = g.free('B', -1.1, 0);
    const C = g.glider('C', { c: A, r: dist(A, B) }, Math.atan2(B.y - A.y, -(B.x - A.x)));
    const ext = 1.9 * dist(A, B);
    const D = g.point('D', add(A, mul(unit(sub(B, A)), ext)));
    const E = g.point('E', add(A, mul(unit(sub(C, A)), ext)));
    g.segment(A, D);
    g.segment(A, E);
    g.segment(B, C);
    const F = g.glider('F', [B, D], 0.55);
    const G = g.point('G', along(A, C, dist(A, F)));
    g.segment(F, C);
    g.segment(G, B);
    g.equal('∠ABC = ∠ACB', deg(angle(A, B, C)), deg(angle(A, C, B)));
    g.equal('∠CBD = ∠BCE', deg(angle(C, B, D)), deg(angle(B, C, E)));
    g.equal('FC = GB', dist(F, C), dist(G, B));
  },
});
