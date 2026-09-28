import { figure } from '../../geometry/figure';
import { add, angle, deg, mul, sub, unit } from '../../geometry/vec';

// The first use of Postulate 5. The data are AB, the point G on it, E above it and H on EG
// produced; CD is the parallel to AB through H (the hypothesis). The claims are the three
// conclusions; the readout shows the co-interior angles, which Postulate 5 forces to be exactly
// two right angles.
export default figure({
  build(g) {
    const A = g.free('A', -3.4, 1.2);
    const B = g.free('B', 3.2, 1.5);
    const G = g.glider('G', [A, B], 0.45);
    const E = g.free('E', -1.6, 2.9);
    const H = g.glider('H', [G, add(G, mul(sub(G, E), 2.4))], 0.5);
    const F = g.point('F', add(H, mul(unit(sub(G, E)), 0.9)));
    const d = unit(sub(B, A));
    const C = g.point('C', add(H, mul(d, -3.3)));
    const D = g.point('D', add(H, mul(d, 3.1)));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(E, F);
    g.angle(A, G, H);
    g.angle(G, H, D);
    g.angle(E, G, B);
    g.equal('∠AGH = ∠GHD (alternate)', angle(A, G, H), angle(G, H, D));
    g.equal('∠EGB = ∠GHD (corresponding)', angle(E, G, B), angle(G, H, D));
    g.equal('∠BGH + ∠GHD = 2 right angles', angle(B, G, H) + angle(G, H, D), Math.PI);
    g.show('∠BGH + ∠GHD', `${deg(angle(B, G, H)).toFixed(1)}° + ${deg(angle(G, H, D)).toFixed(1)}°`);
  },
});
