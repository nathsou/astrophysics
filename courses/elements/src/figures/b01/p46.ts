import { figure } from '../../geometry/figure';
import { add, angle, dist, lc, ll, mul, perp, sub, unit } from '../../geometry/vec';

// The square on AB. AC is drawn at right angles to AB at A (I.11); the circle about A through B
// cuts off AD = AB (I.3); DE ∥ AB and BE ∥ AD (I.31) close the figure.
export default figure({
  build(g) {
    const A = g.free('A', -1.4, -1.6);
    const B = g.free('B', 1.5, -1.4);
    const up = unit(perp(sub(B, A)));
    const C = g.point('C', add(A, mul(up, dist(A, B) * 1.35)));
    const D = g.point('D', lc(A, C, { c: A, r: dist(A, B) })[1]);
    g.arc(A, B, D, { aux: true });
    const E = g.point('E', ll(D, add(D, sub(B, A)), B, add(B, sub(D, A))));
    g.segment(A, C);
    g.polygon([A, D, E, B]);
    g.angle(B, A, D, { right: true });
    const s = dist(A, B);
    g.equal('AD = AB', dist(A, D), s);
    g.equal('DE = AB', dist(D, E), s);
    g.equal('EB = AB', dist(E, B), s);
    g.equal('∠ADE = right', angle(A, D, E), Math.PI / 2);
    g.equal('∠ABE = ∠BED = right', angle(A, B, E) + angle(B, E, D), Math.PI);
  },
});
