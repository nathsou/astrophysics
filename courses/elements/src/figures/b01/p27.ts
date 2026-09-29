import { figure } from '../../geometry/figure';
import { add, angle, cross2, mid, mul, rot, side, sub, unit, type V } from '../../geometry/vec';

// Alternate angles equal ⇒ parallel. The data are the line AB, the point E on it and the point F.
// The hypothesis is built by construction: at F the angle EFD is made equal to the angle AEF
// (I.23), on the other side of EF from A, and CD is that arm produced backwards. G is the meeting
// point supposed in the reductio: the lines are drawn bending towards it, dashed, as in Heath's figure.
export default figure({
  build(g) {
    const A = g.free('A', -3.4, 1.3);
    const B = g.free('B', 3.2, 1.6);
    const E = g.glider('E', [A, B], 0.4);
    const F = g.free('F', 0.2, -1.2);
    const phi = angle(A, E, F);
    const toE = unit(sub(E, F));
    const sA = side(E, F, A);
    const cand = [rot(toE, phi), rot(toE, -phi)];
    const dir = cand.find((d) => side(E, F, add(F, d)) === -sA) ?? cand[0];
    const D = g.point('D', add(F, mul(dir, 3.1)));
    const C = g.point('C', add(F, mul(dir, -3.3)));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(E, F);
    g.angle(A, E, F);
    g.angle(E, F, D);
    // the supposed meeting point beyond B, D
    const G: V = add(mid(B, D), mul(unit(sub(B, A)), 1.6));
    const Gp = g.point('G', G);
    g.segment(B, Gp, { dashed: true });
    g.segment(D, Gp, { dashed: true });
    g.equal('∠AEF = ∠EFD', angle(A, E, F), angle(E, F, D));
    const par = cross2(unit(sub(B, A)), unit(sub(D, C)));
    g.equal('AB ∥ CD', par, 0);
  },
});
