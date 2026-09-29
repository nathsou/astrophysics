import { figure } from '../../geometry/figure';
import { add, area, dist, ll, mul, sub } from '../../geometry/vec';

// Similar pentagons ABCDE and FGHKL (the second is the first dilated by k and moved), cut into
// triangles by the diagonals from E and L. M = AC ∩ BE and N = FH ∩ GL.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, 1.6);
    const B = g.free('B', -3.3, 0.5);
    const C = g.free('C', -2.8, -0.9);
    const D = g.free('D', -1.2, -0.9);
    const E = g.free('E', -0.9, 0.7);
    const k = g.param('k', 0.72, { min: 0.3, max: 1.2, label: 'FG : AB' });
    const F = g.free('F', 1.9, 1.3);
    const map = (p: typeof A) => add(F, mul(sub(p, A), k));
    const Gp = g.point('G', map(B));
    const H = g.point('H', map(C));
    const K = g.point('K', map(D));
    const L = g.point('L', map(E));
    const M = g.point('M', ll(A, C, B, E));
    const N = g.point('N', ll(F, H, Gp, L));
    const P1 = [A, B, C, D, E];
    const P2 = [F, Gp, H, K, L];
    g.polygon(P1, { fill: true });
    g.polygon(P2, { fill: true });
    g.path(B, E, C, { aux: true });
    g.path(Gp, L, H, { aux: true });
    g.segment(A, C, { aux: true, dashed: true });
    g.segment(F, H, { aux: true, dashed: true });
    g.segment(B, D, { aux: true, dashed: true });
    g.segment(Gp, K, { aux: true, dashed: true });
    const r = dist(A, B) / dist(F, Gp);
    g.equal('ABCDE : FGHKL = (AB : FG)²', area(P1) / area(P2), r * r);
    g.equal('△ABE : △FGL = △EBC : △LGH', area([A, B, E]) / area([F, Gp, L]), area([E, B, C]) / area([L, Gp, H]));
    g.equal('△ABE : △FGL = △ECD : △LHK', area([A, B, E]) / area([F, Gp, L]), area([E, C, D]) / area([L, H, K]));
    g.equal('AM : MC = FN : NH', dist(A, M) / dist(M, C), dist(F, N) / dist(N, H));
  },
});
