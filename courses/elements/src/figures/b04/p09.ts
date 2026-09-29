import { figure } from '../../geometry/figure';
import { dist, ll, squareOn } from '../../geometry/vec';

// The circle circumscribed about a square: the diagonals meet at the centre E.
export default figure({
  build(g) {
    const A = g.free('A', -1.7, 1.6);
    const B = g.free('B', -1.6, -1.7);
    const [, , c, d] = squareOn(A, B);
    const C = g.point('C', c);
    const D = g.point('D', d);
    g.polygon([A, B, C, D]);
    g.segment(A, C);
    g.segment(B, D);
    const E = g.point('E', ll(A, C, B, D));
    g.circle(E, A);
    g.angle(D, A, C);
    g.angle(C, A, B);
    g.equal('EA = EB', dist(E, A), dist(E, B));
    g.equal('EC = ED', dist(E, C), dist(E, D));
    g.equal('EA = EC', dist(E, A), dist(E, C));
  },
});
