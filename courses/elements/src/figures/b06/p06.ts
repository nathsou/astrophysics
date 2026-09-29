import { figure } from '../../geometry/figure';
import { add, angle, cross2, dist, mul, reflect, rot, sub, unit } from '../../geometry/vec';

// The hypothesis: ∠EDF = ∠BAC and BA : AC = ED : DF. E is built from the free D, F with exactly that.
// G is the reflection of E in DF: Euclid's triangle on DF with the angles of ABC.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, 1.2);
    const B = g.free('B', -3.1, -0.7);
    const C = g.free('C', -0.9, -0.5);
    const D = g.free('D', 1.5, 1.4);
    const F = g.free('F', 2.8, -0.5);
    const s = Math.sign(cross2(sub(C, A), sub(B, A)));
    const E = g.point('E', add(D, mul(rot(unit(sub(F, D)), s * angle(B, A, C)), (dist(D, F) * dist(B, A)) / dist(A, C))));
    const G = g.point('G', reflect(E, D, F));
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, E, F], { fill: true });
    g.polygon([D, G, F], { dashed: true });
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('∠ABC = ∠DEF', angle(A, B, C), angle(D, E, F));
    g.equal('∠ACB = ∠DFE', angle(A, C, B), angle(D, F, E));
    g.equal('ED = DG', dist(E, D), dist(D, G));
  },
});
