import { figure } from '../../geometry/figure';
import { area, dist, goldenCut, mid } from '../../geometry/vec';
import { frame } from './lib';

// AB cut in extreme and mean ratio at C (AC greater), D the midpoint of AC. In the square AE on AB,
// the diagonal from B and the lines through D and C and through their counterparts on the diagonal
// ("the figure drawn double") give the square DN on DB, the square GF on DC and the gnomon OPQ.
export default figure({
  build(g) {
    const A = g.free('A', -1.6, -1.4);
    const B = g.free('B', 1.6, -1.4);
    const C = g.point('C', goldenCut(A, B));
    const D = g.point('D', mid(A, C));
    const f = frame(A, B);
    const b = f.len;
    const c = dist(A, C);
    const E = g.point('E', f.at(b, b));
    const H = g.point('H', f.at(0, b - c / 2));
    const K = g.point('K', f.at(c / 2, b - c / 2));
    const F = g.point('F', f.at(c, b - c / 2));
    const G = g.point('G', f.at(c / 2, b - c));
    const L = g.point('L', f.at(c / 2, b));
    const M = g.point('M', f.at(b, b - c));
    const N = g.point('N', f.at(b, b - c / 2));
    const R = g.point('R', f.at(0, b - c));
    const S = g.point('S', f.at(c, b));
    const top = f.at(0, b);
    const onDiag = f.at(c, b - c);
    g.polygon([R, onDiag, S, top], { aux: true, name: 'RS' });
    g.polygon([G, onDiag, F, K], { fill: true, name: ['FG', 'GF'] });
    g.polygon([H, K, L, top], { aux: true, name: 'HL' });
    g.polygon([C, B, N, F], { aux: true });
    g.polygon([C, B, E, S], { aux: true });
    g.polygon([M, N, F, onDiag], { aux: true, name: 'MF' });
    g.polygon([F, N, E, S], { aux: true, name: 'FE' });
    g.polygon([C, onDiag, G, D], { aux: true, name: 'CG' });
    g.polygon([D, B, N, F, onDiag, G], { fill: true, name: 'OPQ' });
    g.polygon([D, B, N, K]);
    g.polygon([A, B, E, top]);
    g.segment(B, top, { aux: true });
    g.segment(D, L, { aux: true });
    g.segment(C, S, { aux: true });
    g.segment(H, N, { aux: true });
    g.segment(R, M, { aux: true });
    g.text(f.at((c + b) / 2, (b - c) / 2), 'P', { from: 10 });
    g.text(f.at((c + b) / 2, b - (3 * c) / 4), 'O', { from: 10 });
    g.text(f.at((3 * c) / 4, (b - c) / 2), 'Q', { from: 10 });
    g.equal('AB·BC = □AC', b * dist(B, C), c * c);
    g.equal('gnomon OPQ = rectangle CE', area([D, B, N, F, onDiag, G]), area([C, B, E, S]));
    g.equal('□BD = 5 □DC', dist(B, D) ** 2, 5 * dist(D, C) ** 2);
  },
});
