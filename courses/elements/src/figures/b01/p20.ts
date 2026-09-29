import { figure } from '../../geometry/figure';
import { add, angle, deg, dist, mul, sub, unit } from '../../geometry/vec';

// I.20 (triangle inequality): BA is produced to D with AD = AC, so BD = BA + AC.
export default figure({
  build(g) {
    const A = g.free('A', -0.5, 1.2);
    const B = g.free('B', -1.6, -0.6);
    const C = g.free('C', 1.6, -0.6);
    const D = g.point('D', add(A, mul(unit(sub(A, B)), dist(A, C))));
    g.polygon([A, B, C]);
    g.segment(A, D);
    g.segment(D, C);
    g.equal('∠ADC = ∠ACD', deg(angle(A, D, C)), deg(angle(A, C, D)));
    g.claim('∠BCD > ∠BDC', angle(B, C, D) > angle(B, D, C));
    g.claim('BA + AC > BC', dist(B, A) + dist(A, C) > dist(B, C));
    g.claim('AB + BC > AC', dist(A, B) + dist(B, C) > dist(A, C));
    g.claim('BC + CA > AB', dist(B, C) + dist(C, A) > dist(A, B));
  },
});
