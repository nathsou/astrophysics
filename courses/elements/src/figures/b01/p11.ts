import { figure } from '../../geometry/figure';
import { angle, cc, deg, dist, side, sub, add } from '../../geometry/vec';

// I.11: C is given on AB, D is taken at random on AC, CE = CD, and F is the apex of the
// equilateral triangle on DE (on the left of AB, as in Heath's figure).
export default figure({
  build(g) {
    const A = g.free('A', -2, 0);
    const B = g.free('B', 2, 0);
    const C = g.glider('C', [A, B], 0.55);
    const D = g.glider('D', [A, C], 0.45);
    const E = g.point('E', add(C, sub(C, D)));
    const [l, r] = cc({ c: D, r: dist(D, E) }, { c: E, r: dist(D, E) });
    const F = g.point('F', side(A, B, l) > 0 ? l : r);
    g.segment(A, B);
    g.path(D, F, E);
    g.segment(F, C);
    g.angle(D, C, F, { right: true });
    g.equal('∠DCF = 90°', deg(angle(D, C, F)), 90);
    g.equal('∠FCE = 90°', deg(angle(F, C, E)), 90);
  },
});
