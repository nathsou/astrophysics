import { figure } from '../../geometry/figure';
import { add, angle, Degenerate, dist, foot, lc, mul, rot, cross2, sub, unit } from '../../geometry/vec';

// The ambiguous case (side, side, angle not included). ∠A = ∠D and AB : BC = DE : EF, with the
// angles at C and F acute. G is the other point of AC at distance BC from B: the triangle ABG
// satisfies the same side-side-angle data, but its angle AGB is obtuse. That is the triangle the
// reductio produces, and it is why the proposition needs the condition on the angles at C, F.
export default figure({
  build(g) {
    const A = g.free('A', -3.8, -0.8);
    const B = g.free('B', -1.5, 1.0);
    const C = g.free('C', -0.4, -0.8);
    if (angle(A, C, B) >= Math.PI / 2 - 0.05 || angle(B, A, C) >= Math.PI / 2) throw new Degenerate('the angle at C must be acute');
    const Gp = sub(mul(foot(B, A, C), 2), C);
    const G = g.point('G', Gp);
    const D = g.free('D', 0.6, -0.6);
    const E = g.free('E', 1.4, 0.9);
    // F on the ray from D making the angle A with DE, at distance EF = DE·BC/AB from E, the far point (acute angle at F)
    const s = Math.sign(cross2(sub(B, A), sub(C, A)));
    const ray = add(D, rot(unit(sub(E, D)), s * angle(B, A, C)));
    const ef = (dist(D, E) * dist(B, C)) / dist(A, B);
    const F = g.point('F', lc(D, ray, { c: E, r: ef })[1]);
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, E, F], { fill: true });
    g.segment(B, G, { dashed: true });
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('∠ABC = ∠DEF', angle(A, B, C), angle(D, E, F));
    g.equal('∠C = ∠F', angle(A, C, B), angle(D, F, E));
    g.equal('BG = BC', dist(B, G), dist(B, C));
    const between = dist(A, G) + dist(G, C) <= dist(A, C) + 1e-9;
    g.claim('G between A and C ⇒ ∠AGB obtuse', !between || angle(A, G, B) > Math.PI / 2);
  },
});
