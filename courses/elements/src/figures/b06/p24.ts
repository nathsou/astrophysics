import { figure } from '../../geometry/figure';
import { add, angle, dist, ll, sub } from '../../geometry/vec';
import { similar } from './lib';

// A parallelogram ABCD with diameter AC. Through F on AC, EF ∥ BC and GF ∥ CD; produced, they give
// the second parallelogram HK = FHCK about the diameter.
export default figure({
  build(g) {
    const A = g.free('A', -2, 1.2);
    const B = g.free('B', -2.6, -1.2);
    const D = g.free('D', 1.6, 1.2);
    const C = g.point('C', add(B, sub(D, A)));
    const F = g.glider('F', [A, C], 0.42);
    const E = g.point('E', ll(F, add(F, sub(C, B)), A, B));
    const Gp = g.point('G', ll(F, add(F, sub(C, D)), A, D));
    const H = g.point('H', ll(Gp, F, B, C));
    const K = g.point('K', ll(E, F, D, C));
    g.polygon([A, B, C, D]);
    g.segment(A, C, { aux: true });
    g.polygon([A, E, F, Gp], { fill: true });
    g.polygon([F, H, C, K], { fill: true });
    g.equal('BA : AD = EA : AG', dist(B, A) / dist(A, D), dist(E, A) / dist(A, Gp));
    g.equal('∠AFG = ∠DCA', angle(A, F, Gp), angle(D, C, A));
    g.claim('EG ∼ ABCD', similar([A, E, F, Gp], [A, B, C, D]));
    g.claim('HK ∼ ABCD', similar([C, K, F, H], [C, D, A, B]));
  },
});
