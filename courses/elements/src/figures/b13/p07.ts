import { figure } from '../../geometry/figure';
import { add, angle, cc, deg, dist, dot, ll, perp, rad, rot, sub, unit } from '../../geometry/vec';

// An equilateral pentagon ABCDE whose angles at A and B are both θ: C and E are laid off at that
// angle, and D is where the circles about C and E with the side as radius meet. Euclid's first steps
// hold for every θ (AC = BE, FC = FE, ∠BCD = ∠AED); only when the angle at C is also θ (θ = 108°) is
// the pentagon equiangular.
export default figure({
  build(g) {
    const th = g.param('θ', 108, { min: 96, max: 124, label: 'angles at A and B (°)' });
    const A = g.free('A', -1, -1.4);
    const B = g.free('B', 1, -1.4);
    const s = dist(A, B);
    const C = g.point('C', add(B, rot(sub(A, B), -rad(th))));
    const E = g.point('E', add(A, rot(sub(B, A), rad(th))));
    const n = perp(unit(sub(B, A)));
    const [d1, d2] = cc({ c: C, r: s }, { c: E, r: s });
    const D = g.point('D', dot(sub(d1, A), n) > dot(sub(d2, A), n) ? d1 : d2);
    const F = g.point('F', ll(A, C, B, E));
    g.polygon([A, B, C, D, E], { fill: true });
    g.segment(A, C, { aux: true });
    g.segment(B, E, { aux: true });
    g.segment(F, D, { aux: true });
    g.segment(B, D, { aux: true, dashed: true });
    const ang = { A: deg(angle(E, A, B)), B: deg(angle(A, B, C)), C: deg(angle(B, C, D)), D: deg(angle(C, D, E)), E: deg(angle(D, E, A)) };
    g.show('∠C, ∠D, ∠E', `${ang.C.toFixed(1)}°, ${ang.D.toFixed(1)}°, ${ang.E.toFixed(1)}°`);
    g.equal('AC = BE', dist(A, C), dist(B, E));
    g.equal('AF = BF', dist(A, F), dist(B, F));
    g.equal('FC = FE', dist(F, C), dist(F, E));
    g.equal('∠BCD = ∠AED', ang.C, ang.E);
    const allEqual = [ang.B, ang.C, ang.D, ang.E].every((x) => Math.abs(x - ang.A) < 1e-6);
    g.claim('if ∠C = ∠A = ∠B, the pentagon is equiangular', Math.abs(ang.C - ang.A) > 1e-6 || allEqual);
  },
});
