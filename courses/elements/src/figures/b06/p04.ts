import { figure } from '../../geometry/figure';
import { add, dist, ll, mul, sub } from '../../geometry/vec';

// Two equiangular triangles ABC, DCE with their bases BC, CE in one straight line. DCE is ABC
// dilated by the factor k and slid along the base, so the hypothesis (equal angles) always holds.
export default figure({
  build(g) {
    const B = g.free('B', -2.2, -1);
    const C = g.free('C', -0.2, -1);
    const A = g.free('A', -1.5, 0.6);
    const k = g.param('k', 0.75, { min: 0.3, max: 1.8, label: 'CE : BC' });
    const E = g.point('E', add(C, mul(sub(C, B), k)));
    const D = g.point('D', add(C, mul(sub(A, B), k)));
    const F = g.point('F', ll(B, A, E, D));
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, C, E], { fill: true });
    g.segment(A, F, { aux: true });
    g.segment(F, D, { aux: true });
    g.segment(B, E);
    g.equal('AB : BC = DC : CE', dist(A, B) / dist(B, C), dist(D, C) / dist(C, E));
    g.equal('BC : CA = CE : ED', dist(B, C) / dist(C, A), dist(C, E) / dist(E, D));
    g.equal('BA : AC = CD : DE', dist(B, A) / dist(A, C), dist(C, D) / dist(D, E));
    g.equal('FA = DC', dist(F, A), dist(D, C));
  },
});
