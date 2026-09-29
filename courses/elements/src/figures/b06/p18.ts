import { figure } from '../../geometry/figure';
import { angle, dist } from '../../geometry/vec';
import { simMap, similar } from './lib';

// The given figure CDEF (named CE by a diagonal) and the given line AB. Euclid splits CE by the
// diagonal DF and copies each triangle's angles onto AB (I.23); the result is the image of CE under
// the similarity that takes C to A and D to B, which is how the figure computes G and H.
export default figure({
  build(g) {
    const C = g.free('C', -3.2, -0.8);
    const D = g.free('D', -1.4, -0.8);
    const E = g.free('E', -1.1, 0.7);
    const F = g.free('F', -2.8, 1);
    const A = g.free('A', 0.1, -0.8);
    const B = g.free('B', 2.7, -0.8);
    const map = simMap(C, D, A, B);
    const Gp = g.point('G', map(F));
    const H = g.point('H', map(E));
    g.polygon([C, D, E, F], { fill: true });
    g.polygon([A, B, H, Gp], { fill: true });
    g.segment(D, F, { aux: true });
    g.segment(B, Gp, { aux: true });
    g.equal('FC : GA = CD : AB', dist(F, C) / dist(Gp, A), dist(C, D) / dist(A, B));
    g.equal('FE : GH = CD : AB', dist(F, E) / dist(Gp, H), dist(C, D) / dist(A, B));
    g.equal('∠CFE = ∠AGH', angle(C, F, E), angle(A, Gp, H));
    g.claim('AH is similar to CE', similar([C, D, E, F], [A, B, H, Gp]));
  },
});
