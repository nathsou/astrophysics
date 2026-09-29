import { figure } from '../../geometry/figure';
import { add, angle, cross2, ll, sub, unit } from '../../geometry/vec';

// Transitivity of parallelism. EF is given; AB and CD are drawn through A and C parallel to it
// (the hypothesis). The transversal GK has G on AB and K on CD, both gliding; H is where it
// crosses EF.
export default figure({
  build(g) {
    const E = g.free('E', -3.1, 0.1);
    const F = g.free('F', 3.1, 0.3);
    const A = g.free('A', -3.3, 1.7);
    const C = g.free('C', -2.9, -1.6);
    const B = g.point('B', add(A, sub(F, E)));
    const D = g.point('D', add(C, sub(F, E)));
    const G = g.glider('G', [A, B], 0.35);
    const K = g.glider('K', [C, D], 0.65);
    const H = g.point('H', ll(G, K, E, F));
    g.segment(A, B);
    g.segment(E, F);
    g.segment(C, D);
    g.segment(G, K);
    g.angle(A, G, K);
    g.angle(G, H, F);
    g.angle(G, K, D);
    g.equal('∠AGK = ∠GHF', angle(A, G, K), angle(G, H, F));
    g.equal('∠GHF = ∠GKD', angle(G, H, F), angle(G, K, D));
    g.equal('AB ∥ CD', cross2(unit(sub(B, A)), unit(sub(D, C))), 0);
  },
});
