import { figure } from '../../geometry/figure';
import { add, dist, ll, sub } from '../../geometry/vec';

// AB is to be cut like AC, which is cut at D and E. DF, EG are parallel to CB, and DHK to AB.
export default figure({
  build(g) {
    const A = g.free('A', -2.4, -1);
    const B = g.free('B', 2.4, -1);
    const C = g.free('C', 0.9, 1.6);
    const D = g.glider('D', [A, C], 0.3);
    const E = g.glider('E', [D, C], 0.45);
    const cb = sub(B, C);
    const F = g.point('F', ll(D, add(D, cb), A, B));
    const Gp = g.point('G', ll(E, add(E, cb), A, B));
    const ab = sub(B, A);
    const H = g.point('H', ll(D, add(D, ab), E, Gp));
    const K = g.point('K', ll(D, add(D, ab), C, B));
    g.segment(A, B);
    g.segment(A, C);
    g.segment(C, B);
    g.segment(D, F, { aux: true });
    g.segment(E, Gp, { aux: true });
    g.segment(D, K, { aux: true });
    g.polygon([F, Gp, H, D], { aux: true });
    g.polygon([H, Gp, B, K], { aux: true });
    g.equal('AF : AD = FG : DE', dist(A, F) / dist(A, D), dist(F, Gp) / dist(D, E));
    g.equal('FG : DE = GB : EC', dist(F, Gp) / dist(D, E), dist(Gp, B) / dist(E, C));
  },
});
