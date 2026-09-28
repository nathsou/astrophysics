import { figure } from '../../geometry/figure';
import { add, dist, foot, ll, sub, unit } from '../../geometry/vec';

// The incircle: the bisectors of the angles at B and C meet at D, which is equidistant from the sides.
export default figure({
  build(g) {
    const A = g.free('A', -0.5, 2.7);
    const B = g.free('B', -2.5, -1);
    const C = g.free('C', 2.8, -1);
    const bis = (P: typeof A, Q: typeof A, R: typeof A) => add(Q, add(unit(sub(P, Q)), unit(sub(R, Q))));
    const D = g.point('D', ll(B, bis(A, B, C), C, bis(A, C, B)));
    g.polygon([A, B, C]);
    g.segment(B, D);
    g.segment(C, D);
    const E = g.point('E', foot(D, A, B));
    const F = g.point('F', foot(D, B, C));
    const G = g.point('G', foot(D, C, A));
    g.segment(D, E, { aux: true });
    g.segment(D, F, { aux: true });
    g.segment(D, G, { aux: true });
    g.angle(B, E, D, { right: true });
    g.angle(B, F, D, { right: true });
    g.circle(D, E);
    g.equal('DE = DF', dist(D, E), dist(D, F));
    g.equal('DG = DF', dist(D, G), dist(D, F));
  },
});
