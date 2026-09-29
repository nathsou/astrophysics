import { figure } from '../../geometry/figure';
import { add, dist, ll, sub } from '../../geometry/vec';

// To cut off a third of AB: lay off AD = DE = EC on any line through A, join BC, draw DF ∥ BC.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, -0.6);
    const B = g.free('B', 2.2, -0.6);
    const D = g.free('D', -1.3, 0.3);
    const E = g.point('E', add(D, sub(D, A)));
    const C = g.point('C', add(E, sub(D, A)));
    const F = g.point('F', ll(D, add(D, sub(C, B)), A, B));
    g.segment(A, B);
    g.segment(A, C);
    g.segment(B, C);
    g.segment(D, F, { colour: 'red' });
    g.equal('BA = 3·AF', dist(B, A), 3 * dist(A, F));
    g.equal('CD : DA = BF : FA', dist(C, D) / dist(D, A), dist(B, F) / dist(F, A));
  },
});
