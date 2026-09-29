import { figure } from '../../geometry/figure';
import { add, area, cross2, dist, lerp, mul, perp, side, sub, unit } from '../../geometry/vec';

// Converse of I.38. BC and CE are equal bases on one line; D ranges over the points with
// △CDE = △ABC on the same side as A (a line parallel to BE, on which D glides). The claim is that
// AD ∥ BE. F is the impossible point of the reductio, drawn at a supposed position on CD.
export default figure({
  build(g) {
    const B = g.free('B', -3, -1.1);
    const C = g.free('C', -0.6, -1.1);
    const E = g.point('E', add(C, sub(C, B)));
    const A = g.free('A', -2.2, 1.4);
    const h = (2 * area([A, B, C])) / dist(C, E);
    const n = mul(unit(perp(sub(E, C))), side(B, C, A) * h);
    const D = g.glider('D', [add(C, n), add(E, n)], 0.65, { line: true });
    const F = g.point('F', lerp(C, D, 0.78));
    g.segment(B, E);
    g.polygon([A, B, C], { fill: true });
    g.polygon([C, D, E], { fill: true });
    g.segment(A, D);
    g.segment(A, F, { dashed: true });
    g.segment(F, E, { dashed: true });
    g.equal('△ABC = △CDE (hypothesis)', area([A, B, C]), area([C, D, E]));
    g.equal('AD ∥ BE', cross2(unit(sub(D, A)), unit(sub(E, B))), 0);
  },
});
