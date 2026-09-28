import { figure } from '../../geometry/figure';
import { add, angle, cross2, mul, rot, side, sub, unit } from '../../geometry/vec';

// Parallel through a point. D is any point of BC (a glider); at A on DA the angle DAE is made
// equal to the angle ADC (I.23), on the other side of AD from C, and the arm is produced to F.
// Parallelism is then checked, not assumed.
export default figure({
  build(g) {
    const B = g.free('B', -3, -1.1);
    const C = g.free('C', 3, -1.1);
    const A = g.free('A', 0.5, 1.4);
    const D = g.glider('D', [B, C], 0.32);
    const phi = angle(A, D, C);
    const toD = unit(sub(D, A));
    const sC = side(A, D, C);
    const cand = [rot(toD, phi), rot(toD, -phi)];
    const dir = cand.find((d) => side(A, D, add(A, d)) === -sC) ?? cand[0];
    const E = g.point('E', add(A, mul(dir, 2.6)));
    const F = g.point('F', add(A, mul(dir, -2.6)));
    g.segment(B, C);
    g.segment(A, D);
    g.segment(E, F);
    g.angle(D, A, E);
    g.angle(A, D, C);
    g.equal('∠DAE = ∠ADC', angle(D, A, E), angle(A, D, C));
    g.equal('EF ∥ BC', cross2(unit(sub(F, E)), unit(sub(C, B))), 0);
  },
});
