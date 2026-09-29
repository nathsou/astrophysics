import { figure } from '../../geometry/figure';
import { add, area, cross2, dist, lerp, mul, perp, side, sub, unit } from '../../geometry/vec';

// Converse of I.37. The hypothesis is the data: D ranges over the points on the same side of BC as A
// with △DBC = △ABC, which is the line at height 2·△ABC / BC above BC (D glides on it). The claim is
// that AD ∥ BC. E is the point of the reductio (the parallel through A meeting BD elsewhere than
// at D): it cannot exist, so it is drawn at a supposed position, with dashed joins.
export default figure({
  build(g) {
    const B = g.free('B', -1.7, -1.1);
    const C = g.free('C', 1.7, -1.1);
    const A = g.free('A', -0.9, 1.3);
    const h = (2 * area([A, B, C])) / dist(B, C);
    const n = mul(unit(perp(sub(C, B))), side(B, C, A) * h);
    const D = g.glider('D', [add(B, n), add(C, n)], 0.8, { line: true });
    const E = g.point('E', lerp(B, D, 0.78));
    g.segment(B, C);
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, B, C], { fill: true });
    g.segment(A, D);
    g.segment(A, E, { dashed: true });
    g.segment(E, C, { dashed: true });
    g.equal('△ABC = △DBC (hypothesis)', area([A, B, C]), area([D, B, C]));
    g.equal('AD ∥ BC', cross2(unit(sub(D, A)), unit(sub(C, B))), 0);
  },
});
