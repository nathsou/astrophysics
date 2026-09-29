import { figure } from '../../geometry/figure';
import { angle, deg, ll } from '../../geometry/vec';

// I.15: the vertical angles at E, where AB and CD cross.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, 0.5);
    const B = g.free('B', 2.2, -0.5);
    const C = g.free('C', -0.7, 1.7);
    const D = g.free('D', 0.8, -1.6);
    const E = g.point('E', ll(A, B, C, D), { labelDir: 50 });
    g.segment(A, B);
    g.segment(C, D);
    g.angle(A, E, C);
    g.angle(D, E, B);
    g.equal('∠AEC = ∠DEB', deg(angle(A, E, C)), deg(angle(D, E, B)));
    g.equal('∠CEB = ∠AED', deg(angle(C, E, B)), deg(angle(A, E, D)));
    g.equal('sum of the four angles = 360°', deg(angle(A, E, C) + angle(C, E, B) + angle(B, E, D) + angle(D, E, A)), 360);
  },
});
