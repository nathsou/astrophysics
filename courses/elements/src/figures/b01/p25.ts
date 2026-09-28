import { figure } from '../../geometry/figure';
import { angle, deg, Degenerate, dist } from '../../geometry/vec';

// The converse of I.24. The data are the triangle ABC and the second triangle's apex D; E and F
// glide on the circles about D with radii AB and AC, so that DE = AB and DF = AC always hold. The
// remaining hypothesis, BC > EF, is enforced: a drag that would break it is refused.
export default figure({
  build(g) {
    const A = g.free('A', -3, 1.8);
    const B = g.free('B', -4.2, -1);
    const C = g.free('C', -0.8, -1);
    const D = g.free('D', 2.6, 1.8);
    const dirAB = Math.atan2(B.y - A.y, B.x - A.x);
    const E = g.glider('E', { c: D, r: dist(A, B) }, dirAB);
    const F = g.glider('F', { c: D, r: dist(A, C) }, dirAB + 0.62);
    if (!(dist(B, C) > dist(E, F))) throw new Degenerate('hypothesis: BC > EF');
    g.polygon([A, B, C]);
    g.polygon([D, E, F]);
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('AB = DE', dist(A, B), dist(D, E));
    g.equal('AC = DF', dist(A, C), dist(D, F));
    g.claim('BC > EF (hypothesis)', dist(B, C) > dist(E, F));
    const a = angle(B, A, C);
    const d = angle(E, D, F);
    g.claim('∠BAC > ∠EDF', a > d);
    g.show('∠BAC, ∠EDF', `${deg(a).toFixed(1)}°, ${deg(d).toFixed(1)}°`);
  },
});
