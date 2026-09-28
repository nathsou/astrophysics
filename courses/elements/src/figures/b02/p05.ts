import { figure } from '../../geometry/figure';
import { add, area, dist, ll, mid, sub } from '../../geometry/vec';
import { below, frame } from './lib';

// AD·DB + CD² = CB², i.e. (h + x)(h − x) + x² = h²: the rectangle AH is moved into the gnomon NOP.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, 1.8);
    const B = g.free('B', 2.2, 1.8);
    const C = g.point('C', mid(A, B));
    const D = g.glider('D', [C, B], 0.42);
    const h = dist(C, B);
    const f = frame(A, B);
    const dn = below(A, B);
    const u = sub(B, A);
    const { E, F } = g.points({ E: f(h, h), F: f(2 * h, h) });
    const G = g.point('G', ll(D, add(D, dn), E, F));
    const H = g.point('H', ll(D, G, B, E));
    const K = g.point('K', ll(H, add(H, u), A, add(A, dn)));
    const L = g.point('L', ll(K, H, C, E));
    const M = g.point('M', ll(K, H, B, F));
    g.segment(A, B);
    const sq = g.polygon([C, E, F, B]);
    g.segment(B, E, { aux: true });
    g.segment(D, G);
    g.segment(K, M);
    g.segment(A, K);
    const gn = g.polygon([C, B, F, G, H, L], { name: 'NOP', fill: true });
    const CH = g.polygon([C, D, H, L], { name: 'CH' });
    const HF = g.polygon([H, M, F, G], { name: 'HF' });
    g.polygon([D, B, M, H], { name: 'DM' });
    const CM = g.polygon([C, B, M, L], { name: 'CM', aux: true });
    g.polygon([D, B, F, G], { name: 'DF', aux: true });
    const AL = g.polygon([A, C, L, K], { name: 'AL' });
    const AH = g.polygon([A, D, H, K], { name: 'AH', aux: true });
    const LG = g.polygon([L, H, G, E], { name: 'LG' });
    // the letters of the gnomon, around its corner H
    const t = h * 0.14;
    const hx = dist(A, D);
    const hy = 2 * h - hx;
    g.text(f(hx - 1.6 * t, hy - t), 'N', { from: 4 });
    g.text(f(hx + 0.6 * t, hy - t), 'O', { from: 4 });
    g.text(f(hx + 0.6 * t, hy + 1.6 * t), 'P', { from: 4 });
    const ad = dist(A, D);
    const db = dist(D, B);
    const cd = dist(C, D);
    g.equal('AD·DB + CD² = CB²', ad * db + cd * cd, h * h);
    g.equal('CH = HF (complements)', area(CH), area(HF));
    g.equal('AL = CM', area(AL), area(CM));
    g.equal('gnomon NOP = AH = AD·DB', area(gn), area(AH));
    g.equal('NOP + LG = CEFB', area(gn) + area(LG), area(sq));
  },
});
