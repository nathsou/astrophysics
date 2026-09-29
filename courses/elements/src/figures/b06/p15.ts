import { figure } from '../../geometry/figure';
import { add, area, dist, mul, sub, unit } from '../../geometry/vec';

// Equal triangles ABC, ADE with vertical angles at A: CA in line with AD, EA in line with AB.
// The slider sets AD : AC, and AE is then made AB·AC : AD so that the triangles are equal.
export default figure({
  build(g) {
    const A = g.free('A', 0, 0);
    const C = g.free('C', -2, 0.2);
    const B = g.free('B', 0.8, -1.2);
    const k = g.param('k', 0.7, { min: 0.4, max: 1.6, label: 'AD : AC' });
    const ac = dist(A, C);
    const ab = dist(A, B);
    const D = g.point('D', add(A, mul(unit(sub(A, C)), k * ac)));
    const E = g.point('E', add(A, mul(unit(sub(A, B)), ab / k)));
    g.polygon([A, B, C], { fill: true });
    g.polygon([A, D, E], { fill: true });
    g.segment(B, D, { aux: true });
    g.equal('△ABC = △ADE', area([A, B, C]), area([A, D, E]));
    g.equal('CA : AD = EA : AB', dist(C, A) / dist(A, D), dist(E, A) / dist(A, B));
  },
});
