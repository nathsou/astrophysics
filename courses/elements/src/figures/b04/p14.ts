import { figure } from '../../geometry/figure';
import { add, dist, ll, rot, sub, unit } from '../../geometry/vec';

// The circle circumscribed about a regular pentagon: the bisectors at C and D meet at F, and F is
// equidistant from all five vertices.
export default figure({
  build(g) {
    const C = g.free('C', -1.2, -1.6);
    const D = g.free('D', 1.3, -1.7);
    const s = sub(D, C);
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
    g.angle(F, C, D);
    g.angle(C, D, F);
    g.circle(F, A);
    g.equal('FC = FD', dist(F, C), dist(F, D));
    g.equal('FA = FB', dist(F, A), dist(F, B));
    g.equal('FB = FC', dist(F, B), dist(F, C));
    g.equal('FD = FE', dist(F, D), dist(F, E));
  },
});
