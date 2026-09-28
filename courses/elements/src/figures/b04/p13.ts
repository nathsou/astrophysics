import { figure } from '../../geometry/figure';
import { add, angle, deg, dist, foot, ll, rot, sub, unit } from '../../geometry/vec';

// The circle inscribed in a regular pentagon: the bisectors of the angles at C and D meet at F,
// and F is equidistant from all five sides.
export default figure({
  build(g) {
    const C = g.free('C', -1.2, -1.6);
    const D = g.free('D', 1.3, -1.7);
    const s = sub(D, C);
    // the given regular pentagon on CD (counter-clockwise C, D, E, A, B)
    const E = g.point('E', add(D, rot(s, (2 * Math.PI) / 5)));
    const A = g.point('A', add(E, rot(s, (4 * Math.PI) / 5)));
    const B = g.point('B', add(A, rot(s, (6 * Math.PI) / 5)));
    g.polygon([A, B, C, D, E]);
    const bis = (P: typeof A, Q: typeof A, R: typeof A) => add(Q, add(unit(sub(P, Q)), unit(sub(R, Q))));
    const F = g.point('F', ll(C, bis(B, C, D), D, bis(C, D, E)));
    g.segment(C, F);
    g.segment(D, F);
    g.segment(F, B);
    g.segment(F, A);
    g.segment(F, E);
    const P = g.points({ G: foot(F, A, B), H: foot(F, B, C), K: foot(F, C, D), L: foot(F, D, E), M: foot(F, E, A) });
    for (const q of Object.values(P)) g.segment(F, q, { aux: true });
    g.angle(F, P.H, C, { right: true });
    g.angle(F, P.K, C, { right: true });
    g.circle(F, P.G);
    g.equal('∠ABF = ∠FBC', deg(angle(A, B, F)), deg(angle(F, B, C)));
    g.equal('FH = FK', dist(F, P.H), dist(F, P.K));
    g.equal('FG = FH', dist(F, P.G), dist(F, P.H));
    g.equal('FL = FM', dist(F, P.L), dist(F, P.M));
    g.equal('FK = FL', dist(F, P.K), dist(F, P.L));
  },
});
