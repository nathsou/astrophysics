import { figure } from '../../geometry/figure';
import { add, area, dist, ll, mid, sub } from '../../geometry/vec';
import { below, frame } from './lib';

// AD·DB + CB² = CD², i.e. (2h + x)·x + h² = (h + x)²: the rectangle AM is moved into the gnomon NOP.
export default figure({
  build(g) {
    const A = g.free('A', -2.6, 1.8);
    const B = g.free('B', 0.8, 1.8);
    const C = g.point('C', mid(A, B));
    const D = g.glider('D', [B, add(B, sub(B, A))], 0.42);
    const h = dist(C, B);
    const d = dist(A, D);
    const f = frame(A, B);
    const dn = below(A, B);
    const u = sub(B, A);
    const { E, F } = g.points({ E: f(h, d - h), F: f(d, d - h) });
    const G = g.point('G', ll(B, add(B, dn), E, F));
    const H = g.point('H', ll(B, G, D, E));
    const K = g.point('K', ll(H, add(H, u), A, add(A, dn)));
    const L = g.point('L', ll(K, H, C, E));
    const M = g.point('M', ll(K, H, D, F));
    g.segment(A, D);
    const sq = g.polygon([C, E, F, D]);
    g.segment(D, E, { aux: true });
    g.segment(B, G);
    g.segment(K, M);
    g.segment(A, K);
    const gn = g.polygon([C, D, F, G, H, L], { name: 'NOP', fill: true });
    const AL = g.polygon([A, C, L, K], { name: 'AL' });
    const CH = g.polygon([C, B, H, L], { name: 'CH' });
    const HF = g.polygon([H, M, F, G], { name: 'HF' });
    g.polygon([C, D, M, L], { name: 'CM', aux: true });
    const AM = g.polygon([A, D, M, K], { name: 'AM', aux: true });
    const LG = g.polygon([L, H, G, E], { name: 'LG' });
    const t = Math.min(h, d - 2 * h) * 0.28;
    const hx = 2 * h;
    const hy = d - 2 * h;
    g.text(f(hx - 1.6 * t, hy - t * 0.6), 'N', { from: 4 });
    g.text(f(hx + 0.6 * t, hy - t * 0.6), 'O', { from: 4 });
    g.text(f(hx + 0.6 * t, hy + 1.5 * t), 'P', { from: 4 });
    const db = dist(D, B);
    g.equal('AD·DB + CB² = CD²', d * db + h * h, dist(C, D) ** 2);
    g.equal('AL = CH = HF', area(AL), area(HF));
    g.equal('gnomon NOP = AM = AD·DB', area(gn), area(AM));
    g.equal('NOP + LG = CEFD', area(gn) + area(LG), area(sq));
    void CH;
  },
});
