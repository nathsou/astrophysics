import { figure } from '../../geometry/figure';
import { add, angle, area, deg, dist, mul, rot, sub, unit } from '../../geometry/vec';

// I.4 (SAS): DE is kept equal to AB by gliding E on the circle about D, and DF is laid off at the
// same angle as AC, so the hypothesis holds in every position. Turn E to rotate the second triangle.
export default figure({
  build(g) {
    const A = g.free('A', -2.4, 1.3);
    const B = g.free('B', -3.3, -0.9);
    const C = g.free('C', -0.6, -0.8);
    const D = g.free('D', 2.2, 1.3);
    const t0 = Math.atan2(B.y - A.y, B.x - A.x);
    const E = g.glider('E', { c: D, r: dist(A, B) }, t0);
    // the signed angle from AB to AC, reproduced at D from DE
    const ab = sub(B, A);
    const ac = sub(C, A);
    const th = Math.atan2(ab.x * ac.y - ab.y * ac.x, ab.x * ac.x + ab.y * ac.y);
    const F = g.point('F', add(D, mul(rot(unit(sub(E, D)), th), dist(A, C))));
    g.polygon([A, B, C]);
    g.polygon([D, E, F]);
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('BC = EF', dist(B, C), dist(E, F));
    g.equal('∠ABC = ∠DEF', deg(angle(A, B, C)), deg(angle(D, E, F)));
    g.equal('∠ACB = ∠DFE', deg(angle(A, C, B)), deg(angle(D, F, E)));
    g.equal('△ABC = △DEF (area)', area([A, B, C]), area([D, E, F]));
  },
});
