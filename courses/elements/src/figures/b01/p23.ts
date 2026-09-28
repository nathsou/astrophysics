import { figure } from '../../geometry/figure';
import { along, angle, cc, deg, dist } from '../../geometry/vec';

// I.23: copy the angle DCE to A on AB, by building the triangle AFG with the sides of CDE (I.22).
export default figure({
  build(g) {
    const C = g.free('C', -3.2, -0.3);
    const D = g.free('D', -2.3, 1.3);
    const E = g.free('E', -1.6, -0.5);
    const A = g.free('A', 0, -0.3);
    const B = g.free('B', 2.8, -0.3);
    const F = g.point('F', along(A, B, dist(C, D)));
    const [l, r] = cc({ c: A, r: dist(C, E) }, { c: F, r: dist(D, E) });
    // G above AB, as in Heath's figure (on the left of A→B)
    const G = g.point('G', l);
    void r;
    g.path(D, C, E);
    g.segment(D, E, { aux: true });
    g.segment(A, B);
    g.path(F, G, A);
    g.angle(D, C, E);
    g.angle(F, A, G);
    g.equal('∠FAG = ∠DCE', deg(angle(F, A, G)), deg(angle(D, C, E)));
  },
});
