import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';

// I.7 is a reductio: D glides on the circle about A through C, so AD = AC as supposed, and the
// figure shows that DB can then never equal CB, except when D falls on C.
export default figure({
  build(g) {
    const A = g.free('A', -1.5, 0);
    const B = g.free('B', 1.5, 0);
    const C = g.free('C', 0.9, 1.9);
    const D = g.glider('D', { c: A, r: dist(A, C) }, Math.atan2(C.y - A.y, C.x - A.x) - 0.3);
    g.path(A, C, B);
    g.path(A, D, B, { dashed: true });
    g.segment(A, B);
    g.segment(C, D, { aux: true });
    g.equal('AD = AC', dist(A, D), dist(A, C));
    g.show('CB', dist(C, B).toFixed(3));
    g.show('DB', dist(D, B).toFixed(3));
    g.claim('DB ≠ CB', Math.abs(dist(D, B) - dist(C, B)) > 1e-6);
  },
});
