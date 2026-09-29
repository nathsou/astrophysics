import { figure } from '../../geometry/figure';
import { Degenerate, along, angle, cc, deg, dist, side } from '../../geometry/vec';

// I.9: D is taken at random on AB (drag it), AE = AD, and F is the apex of the equilateral
// triangle on DE on the side away from A.
export default figure({
  build(g) {
    const A = g.free('A', 0, 2);
    const B = g.free('B', -1.6, -1.2);
    const C = g.free('C', 1.9, -1);
    const D = g.glider('D', [A, B], 0.55);
    if (dist(A, D) > dist(A, C)) throw new Degenerate('AD must be cut off from AC');
    const E = g.point('E', along(A, C, dist(A, D)));
    const [l, r] = cc({ c: D, r: dist(D, E) }, { c: E, r: dist(D, E) });
    const F = g.point('F', side(D, E, A) > 0 ? r : l);
    g.path(B, A, C);
    g.segment(D, E);
    g.path(D, F, E);
    g.segment(A, F);
    g.equal('∠DAF = ∠EAF', deg(angle(D, A, F)), deg(angle(E, A, F)));
  },
});
