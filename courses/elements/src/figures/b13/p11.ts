import { figure } from '../../geometry/figure';
import { add, dist, ll, mul, regular, sub, unit, v } from '../../geometry/vec';

// The regular pentagon ABCDE in the circle with centre F. AF and BF meet the circle again at G and
// H; FK, on FH, is a fourth of the radius. AG cuts CD at L and BH cuts AC at M, at right angles.
// N is a line whose square is BK² − KM².
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const k = g.circle(F, 2);
    const A = g.glider('A', k, Math.PI / 2);
    const t = Math.atan2(A.y, A.x);
    const [, B, C, D, E] = regular(F, 2, 5, t);
    const P = g.points({ B, C, D, E });
    const G = g.point('G', sub(mul(F, 2), A));
    const H = g.point('H', sub(mul(F, 2), P.B));
    const K = g.point('K', add(F, mul(unit(sub(H, F)), k.r / 4)));
    g.point('L', ll(A, G, P.C, P.D));
    const M = g.point('M', ll(P.B, H, A, P.C));
    g.polygon([A, P.B, P.C, P.D, P.E]);
    g.segment(A, G, { aux: true });
    g.segment(P.B, H, { aux: true });
    g.segment(A, P.C);
    g.segment(A, P.D, { aux: true, dashed: true });
    g.segment(A, H, { aux: true, dashed: true });
    g.segment(M, K, { colour: 'red' });
    const BK = dist(P.B, K);
    const KM = dist(K, M);
    const nLen = Math.sqrt(BK * BK - KM * KM);
    const n0 = v(2.8, -1.6);
    g.segment(n0, add(n0, v(0, nLen)), { name: 'N', text: 'N' });
    g.equal('□MK = 5 □KF', KM ** 2, 5 * dist(K, F) ** 2);
    g.equal('□BK = 5 □KM', BK ** 2, 5 * KM ** 2);
    g.equal('□BK : □N = 5 : 4', BK ** 2 / nLen ** 2, 5 / 4);
    g.equal('□AB = HB·BM', dist(A, P.B) ** 2, dist(H, P.B) * dist(P.B, M));
    g.show('side AB ÷ diameter', (dist(A, P.B) / (2 * k.r)).toFixed(6));
  },
});
