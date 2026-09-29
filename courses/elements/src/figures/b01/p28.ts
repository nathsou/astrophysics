import { figure } from '../../geometry/figure';
import { add, angle, cross2, mul, rot, side, sub, unit } from '../../geometry/vec';

// Exterior angle = interior opposite angle (or co-interior angles = two right angles) ⇒ parallel.
// The data are AB, the point G on it, E above it and H on EG produced. The hypothesis is built by
// construction: at H the angle GHD is made equal to the angle EGB, on the same side of EF as B.
export default figure({
  build(g) {
    const A = g.free('A', -3.4, 1.2);
    const B = g.free('B', 3.2, 1.5);
    const G = g.glider('G', [A, B], 0.45);
    const E = g.free('E', -1.6, 2.9);
    const H = g.glider('H', [G, add(G, mul(sub(G, E), 2.4))], 0.5);
    const F = g.point('F', add(H, mul(unit(sub(G, E)), 0.9)));
    const phi = angle(E, G, B);
    const toG = unit(sub(G, H));
    const sB = side(G, H, B);
    const cand = [rot(toG, phi), rot(toG, -phi)];
    const dir = cand.find((d) => side(G, H, add(H, d)) === sB) ?? cand[0];
    const D = g.point('D', add(H, mul(dir, 3.1)));
    const C = g.point('C', add(H, mul(dir, -3.3)));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(E, F);
    g.angle(E, G, B);
    g.angle(G, H, D);
    g.equal('∠EGB = ∠GHD', angle(E, G, B), angle(G, H, D));
    g.equal('∠BGH + ∠GHD = 2 right angles', angle(B, G, H) + angle(G, H, D), Math.PI);
    g.equal('AB ∥ CD', cross2(unit(sub(B, A)), unit(sub(D, C))), 0);
  },
});
