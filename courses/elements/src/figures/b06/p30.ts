import { figure } from '../../geometry/figure';
import { add, area, dist, mul, perp, sub, unit } from '../../geometry/vec';

// The square BC = BACX on AB (below it). The parallelogram CD = CGDF is applied to AC equal to the
// square and exceeding by the square AD = AGDE (VI.29): its side x solves x(AB + x) = AB². Then E
// cuts AB in extreme and mean ratio.
export default figure({
  build(g) {
    const A = g.free('A', -1.2, 1);
    const B = g.free('B', 1.6, 1);
    const l = dist(A, B);
    const e = unit(sub(B, A));
    const up = perp(e);
    const C = g.point('C', sub(A, mul(up, l)));
    const X = sub(B, mul(up, l));
    // VI.29 with the half of AC: x = √((l/2)² + l²) − l/2
    const x = Math.sqrt((l / 2) ** 2 + l * l) - l / 2;
    const Gv = add(A, mul(up, x));
    const E = g.point('E', add(A, mul(e, x)));
    const D = g.point('D', add(Gv, mul(e, x)));
    const F = g.point('F', add(C, mul(e, x)));
    g.polygon([B, A, C, X], { fill: true });
    g.polygon([C, Gv, D, F], { aux: true });
    g.polygon([A, Gv, D, E], { fill: true });
    g.polygon([F, E, B, X], { fill: true });
    g.polygon([C, A, E, F], { aux: true });
    g.equal('BA : AE = AE : EB', dist(B, A) / dist(A, E), dist(A, E) / dist(E, B));
    g.equal('▱CD = □BC', area([C, Gv, D, F]), l * l);
    g.equal('▱BF = □AD', area([F, E, B, X]), area([A, Gv, D, E]));
    g.show('AB : AE (the golden ratio φ)', (l / x).toFixed(6));
  },
});
