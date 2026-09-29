import { figure } from '../../geometry/figure';
import { angle, cc, dist, reflect, side } from '../../geometry/vec';

// The hypothesis is only that the sides are proportional: DEF is built on the free side EF from the
// lengths DE = k·AB and DF = k·AC, where k = EF : BC. G is the reflection of D in EF, the triangle
// Euclid builds on EF with the angles of ABC.
export default figure({
  build(g) {
    const A = g.free('A', -2.4, 1.1);
    const B = g.free('B', -3, -0.6);
    const C = g.free('C', -0.9, -0.6);
    const E = g.free('E', 0.3, 0.2);
    const F = g.free('F', 2.9, 0.2);
    const k = dist(E, F) / dist(B, C);
    const [left, right] = cc({ c: E, r: k * dist(A, B) }, { c: F, r: k * dist(A, C) });
    const D = g.point('D', side(B, C, A) > 0 ? left : right);
    const G = g.point('G', reflect(D, E, F));
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, E, F], { fill: true });
    g.polygon([G, E, F], { dashed: true });
    g.equal('∠ABC = ∠DEF', angle(A, B, C), angle(D, E, F));
    g.equal('∠BCA = ∠EFD', angle(B, C, A), angle(E, F, D));
    g.equal('∠BAC = ∠EDF', angle(B, A, C), angle(E, D, F));
    g.equal('DE = GE', dist(D, E), dist(G, E));
  },
});
