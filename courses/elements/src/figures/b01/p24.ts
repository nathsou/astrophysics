import { figure } from '../../geometry/figure';
import { Degenerate, add, angle, deg, dist, mul, rot, sub, unit } from '../../geometry/vec';

// I.24 (the hinge theorem): DE = AB and DF = AC are kept by gliding E and F on circles about D.
// The angle at A must be the greater (other drags are refused). DG copies AC at the angle BAC (I.23).
export default figure({
  build(g) {
    const A = g.free('A', -2.8, 1.5);
    const B = g.free('B', -3.6, -0.6);
    const C = g.free('C', -0.7, -0.5);
    const D = g.free('D', 1.6, 1.5);
    const E = g.glider('E', { c: D, r: dist(A, B) }, Math.atan2(B.y - A.y, B.x - A.x));
    const F = g.glider('F', { c: D, r: dist(A, C) }, Math.atan2(B.y - A.y, B.x - A.x) + 0.62);
    // the signed angle from AB to AC, reproduced at D from DE
    const ab = sub(B, A);
    const ac = sub(C, A);
    const th = Math.atan2(ab.x * ac.y - ab.y * ac.x, ab.x * ac.x + ab.y * ac.y);
    const de = sub(E, D);
    const df = sub(F, D);
    const phi = Math.atan2(de.x * df.y - de.y * df.x, de.x * df.x + de.y * df.y);
    if (!(Math.sign(phi) === Math.sign(th) && Math.abs(phi) < Math.abs(th) - 1e-3)) throw new Degenerate('the angle at A must be the greater, on the same side');
    const G = g.point('G', add(D, mul(rot(unit(de), th), dist(A, C))));
    g.polygon([A, B, C]);
    g.polygon([D, E, F]);
    g.path(D, G, E);
    g.segment(F, G);
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('EG = BC', dist(E, G), dist(B, C));
    g.equal('∠DGF = ∠DFG', deg(angle(D, G, F)), deg(angle(D, F, G)));
    g.claim('BC > EF', dist(B, C) > dist(E, F));
  },
});
