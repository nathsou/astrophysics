import { figure } from '../../geometry/figure';
import { cc, dist, mul, sub } from '../../geometry/vec';

export default figure({
  build(g) {
    const A = g.free('A', -1, 0);
    const B = g.free('B', 1, 0);
    const k1 = g.circle(A, B, { aux: true, colour: 'red' });
    const k2 = g.circle(B, A, { aux: true, colour: 'blue' });
    const C = g.point('C', cc(k1, k2)[0]);
    // D and E only name the circles ("the circle BCD"): the far ends of the diameters through B and A.
    g.point('D', sub(mul(A, 2), B));
    g.point('E', sub(mul(B, 2), A));
    g.segment(A, B, { colour: 'black' });
    g.segment(C, A, { colour: 'red' });
    g.segment(C, B, { colour: 'blue' });
    g.equal('CA = AB', dist(C, A), dist(A, B));
    g.equal('CB = AB', dist(C, B), dist(A, B));
  },
});
