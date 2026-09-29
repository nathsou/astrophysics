import { figure } from '../../geometry/figure';
import { angle, dist, foot, mid } from '../../geometry/vec';

// A glides on the semicircle on BC, so the angle BAC stays right; AD is the altitude.
export default figure({
  build(g) {
    const B = g.free('B', -2, 0);
    const C = g.free('C', 2, 0);
    const M = mid(B, C);
    const A = g.glider('A', { c: M, r: dist(B, C) / 2 }, 2.1 + Math.atan2(C.y - B.y, C.x - B.x));
    const D = g.point('D', foot(A, B, C));
    g.polygon([A, B, C]);
    g.segment(A, D, { colour: 'red' });
    g.angle(B, A, C, { right: true });
    g.angle(A, D, C, { right: true });
    g.equal('BC : BA = AB : BD', dist(B, C) / dist(B, A), dist(A, B) / dist(B, D));
    g.equal('BC : CA = AC : CD', dist(B, C) / dist(C, A), dist(A, C) / dist(C, D));
    g.equal('∠BAD = ∠ACB', angle(B, A, D), angle(A, C, B));
    g.equal('BD : DA = AD : DC (porism)', dist(B, D) / dist(D, A), dist(A, D) / dist(D, C));
  },
});
