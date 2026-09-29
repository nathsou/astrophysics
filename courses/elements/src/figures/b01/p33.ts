import { figure } from '../../geometry/figure';
import { add, angle, cross2, dist, sub, unit } from '../../geometry/vec';

// AB and CD are equal and parallel (the hypothesis: D = C + (B − A)); AC and BD join their
// ends in the same directions, and BC is the diagonal of the proof.
export default figure({
  build(g) {
    const A = g.free('A', -1.9, 1.2);
    const B = g.free('B', 2, 1.4);
    const C = g.free('C', -2.8, -1.2);
    const D = g.point('D', add(C, sub(B, A)));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(A, C);
    g.segment(B, D);
    g.segment(B, C, { aux: true });
    g.angle(A, B, C);
    g.angle(B, C, D);
    g.equal('AC = BD', dist(A, C), dist(B, D));
    g.equal('∠ACB = ∠CBD', angle(A, C, B), angle(C, B, D));
    g.equal('AC ∥ BD', cross2(unit(sub(C, A)), unit(sub(D, B))), 0);
  },
});
