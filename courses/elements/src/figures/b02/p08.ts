import { figure } from '../../geometry/figure';
import { add, area, dist, ll, sub } from '../../geometry/vec';
import { below, frame } from './lib';

// 4(a + b)·b + a² = (a + 2b)²: the square on AD, "drawn double", is four rectangles AB·BC
// (as eight pieces: the gnomon STU) around the square OH on AC.
export default figure({
  build(g) {
    const A = g.free('A', -2.6, 2.5);
    const B = g.free('B', 1.0, 2.5);
    const C = g.glider('C', [A, B], 0.6);
    const D = g.point('D', add(B, sub(B, C)));
    const f = frame(A, B);
    const dn = below(A, B);
    const u = sub(B, A);
    const s = dist(A, D);
    const { E, F } = g.points({ E: f(0, s), F: f(s, s) });
    g.segment(A, D);
    const sq = g.polygon([A, E, F, D]);
    g.segment(D, E, { aux: true });
    const K = g.point('K', ll(B, add(B, dn), D, E));
    const M = g.point('M', ll(K, add(K, u), A, E));
    const G = g.point('G', ll(K, M, C, add(C, dn)));
    const N = g.point('N', ll(K, M, D, F));
    const Q = g.point('Q', ll(C, G, D, E));
    const O = g.point('O', ll(Q, add(Q, u), A, E));
    const R = g.point('R', ll(O, Q, B, K));
    const P = g.point('P', ll(O, Q, D, F));
    const H = g.point('H', ll(C, Q, E, F));
    const L = g.point('L', ll(B, R, E, F));
    g.segment(C, H);
    g.segment(B, L);
    g.segment(M, N);
    g.segment(O, P);
    const gn = g.polygon([A, D, F, H, Q, O], { name: 'STU', fill: true });
    const CK = g.polygon([C, B, K, G], { name: 'CK' });
    const KD = g.polygon([B, D, N, K], { name: 'KD' });
    const GR = g.polygon([G, K, R, Q], { name: 'GR' });
    const RN = g.polygon([K, N, P, R], { name: 'RN' });
    g.polygon([C, D, P, Q], { name: 'CP', aux: true });
    const AG = g.polygon([A, C, G, M], { name: 'AG' });
    const MQ = g.polygon([M, G, Q, O], { name: 'MQ' });
    const QL = g.polygon([Q, R, L, H], { name: 'QL' });
    const RF = g.polygon([R, P, F, L], { name: 'RF' });
    g.polygon([M, K, L, E], { name: 'ML', aux: true });
    const AK = g.polygon([A, B, K, M], { name: 'AK', aux: true });
    const OH = g.polygon([O, Q, H, E], { name: 'OH' });
    const b = dist(B, C);
    const t = b * 0.3;
    const qx = dist(A, C);
    const qy = 2 * b;
    g.text(f(qx - 1.4 * t, qy - 0.5 * t), 'S', { from: 10 });
    g.text(f(qx + 0.5 * t, qy - 0.5 * t), 'T', { from: 10 });
    g.text(f(qx + 0.5 * t, qy + 1.4 * t), 'U', { from: 10 });
    const ab = dist(A, B);
    const ac = dist(A, C);
    g.equal('4·AB·BC + AC² = (AB + BC)²', 4 * ab * b + ac * ac, (ab + b) ** 2);
    g.equal('CK = KD = GR = RN', area(CK) + area(KD) + area(GR) + area(RN), 4 * area(CK));
    g.equal('AG = MQ = QL = RF', area(AG) + area(MQ) + area(QL) + area(RF), 4 * area(AG));
    g.equal('gnomon STU = 4·AK', area(gn), 4 * area(AK));
    g.equal('STU + OH = AEFD', area(gn) + area(OH), area(sq));
  },
});
