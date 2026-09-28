import { figure } from '../../geometry/figure';
import { add, cc, dist, ll, sub, unit } from '../../geometry/vec';

// I.10: the equilateral triangle ABC (I.1), then the bisector CD of the angle ACB (I.9).
export default figure({
  build(g) {
    const A = g.free('A', -1.5, 0);
    const B = g.free('B', 1.5, 0);
    const C = g.point('C', cc({ c: A, r: dist(A, B) }, { c: B, r: dist(A, B) })[0]);
    const w = add(unit(sub(A, C)), unit(sub(B, C)));
    const D = g.point('D', ll(C, add(C, w), A, B));
    g.polygon([A, B, C]);
    g.segment(C, D);
    g.equal('AD = DB', dist(A, D), dist(D, B));
  },
});
