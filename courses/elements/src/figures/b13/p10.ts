import { figure } from '../../geometry/figure';
import { add, dist, foot, ll, mul, regular, sub, unit, v } from '../../geometry/vec';

// The regular pentagon ABCDE in the circle with centre F. AF meets the circle again at G; the
// perpendicular FH on AB meets the circle at K (AK is the side of the decagon); the perpendicular
// FL on AK meets the circle at M and AB at N. Then AB·BN = BF² and BA·AN = AK², and adding:
// the square on the pentagon's side is the sum of the squares on the hexagon's and decagon's.
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const k = g.circle(F, 2);
    const A = g.glider('A', k, Math.PI / 2 + 0.1);
    const t = Math.atan2(A.y, A.x);
    const [, B, C, D, E] = regular(F, 2, 5, t);
    const P = g.points({ B, C, D, E });
    const G = g.point('G', sub(mul(F, 2), A));
    const H = g.point('H', foot(F, A, P.B));
    const K = g.point('K', add(F, mul(unit(sub(H, F)), k.r)));
    const L = g.point('L', foot(F, A, K));
    const M = g.point('M', add(F, mul(unit(sub(L, F)), k.r)));
    const N = g.point('N', ll(F, M, A, P.B));
    g.polygon([A, P.B, P.C, P.D, P.E]);
    g.segment(A, G, { aux: true });
    g.segment(F, P.B);
    g.segment(F, K, { aux: true });
    g.segment(F, M, { aux: true });
    g.path(A, K, P.B, { colour: 'blue' });
    g.segment(K, N, { aux: true });
    const AB = dist(A, P.B);
    const BF = dist(P.B, F);
    const AK = dist(A, K);
    g.equal('AB·BN = □BF', AB * dist(P.B, N), BF * BF);
    g.equal('BA·AN = □AK', AB * dist(A, N), AK * AK);
    g.equal('□AB = □BF + □AK (pentagon² = hexagon² + decagon²)', AB * AB, BF * BF + AK * AK);
    g.equal('arc CG = arc AK (both a tenth of the circle)', dist(P.C, G), AK);
  },
});
