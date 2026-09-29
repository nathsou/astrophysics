import { figure } from '../../geometry/figure';
import { add, area, dist, sub, v } from '../../geometry/vec';

// Triangles ABC, ACD under the same height (the apex A), with bases BC, CD on one line. The bases are
// laid off again: BG = GH = BC to the left, DK = KL = CD to the right, so HC = 3·BC and LC = 3·CD.
// E and F complete the parallelograms EC (on BC) and CF (on CD) with their top side through A.
export default figure({
  build(g) {
    const C = g.point('C', v(0, 0));
    const B = g.glider('B', [v(-1.9, 0), v(-0.5, 0)], 0.35);
    const D = g.glider('D', [v(0.4, 0), v(1.5, 0)], 0.4);
    const A = g.free('A', 0.3, 2.3);
    const bc = sub(B, C);
    const cd = sub(D, C);
    const G = g.point('G', add(B, bc));
    const H = g.point('H', add(G, bc));
    const K = g.point('K', add(D, cd));
    const L = g.point('L', add(K, cd));
    const E = g.point('E', add(A, bc));
    const F = g.point('F', add(A, cd));
    g.segment(H, L);
    g.polygon([E, B, C, A], { fill: true });
    g.polygon([A, C, D, F], { fill: true });
    g.polygon([A, B, C]);
    g.polygon([A, C, D]);
    for (const P of [G, H, K, L]) g.segment(A, P, { aux: true });
    const abc = area([A, B, C]);
    const acd = area([A, C, D]);
    g.equal('△ABC : △ACD = BC : CD', abc / acd, dist(B, C) / dist(C, D));
    g.equal('▱EC : ▱CF = BC : CD', area([E, B, C, A]) / area([A, C, D, F]), dist(B, C) / dist(C, D));
    g.equal('△AHC = 3·△ABC', area([A, H, C]), 3 * abc);
    g.equal('△ALC = 3·△ACD', area([A, L, C]), 3 * acd);
  },
});
