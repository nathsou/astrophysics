import { figure } from '../../geometry/figure';
import { area, dist, goldenCut } from '../../geometry/vec';
import { frame } from './lib';

// AB cut in extreme and mean ratio at C (AC the greater segment), AD = ½AB set out beyond A. The
// square AE on AB (with K over A, G over C) and the square DF on DC, divided by the lines through
// A and H into the square AP on DA, the square FH on AC and the two rectangles; MNO is the gnomon.
export default figure({
  build(g) {
    const A = g.free('A', -0.6, 0.4);
    const B = g.free('B', 2.4, 0.4);
    const C = g.point('C', goldenCut(A, B));
    const f = frame(A, B);
    const a = f.len / 2;
    const c = dist(A, C);
    const D = g.point('D', f.at(-a, 0));
    const K = g.point('K', f.at(0, 2 * a));
    const E = g.point('E', f.at(2 * a, 2 * a));
    const G = g.point('G', f.at(c, 2 * a));
    const F = g.point('F', f.at(c, -(a + c)));
    const L = g.point('L', f.at(-a, -(a + c)));
    const H = g.point('H', f.at(0, -a));
    const P = g.point('P', f.at(-a, -a));
    const cH = f.at(c, -a);
    const aF = f.at(0, -(a + c));
    g.polygon([C, B, E, G], { aux: true });
    g.polygon([A, C, G, K], { aux: true });
    g.polygon([A, C, cH, H], { aux: true, name: ['CH', 'HC'] });
    g.polygon([H, cH, F, aF], { aux: true, name: ['FH', 'HF'] });
    g.polygon([P, H, aF, L], { aux: true, name: 'LH' });
    g.polygon([A, C, F, L, P, H], { fill: true, name: 'MNO' });
    g.polygon([D, A, H, P]);
    g.segment(D, B);
    g.polygon([A, B, E, K]);
    g.polygon([D, C, F, L]);
    g.text(f.at(-a / 2, -a - c / 2), 'M', { from: 9 });
    g.text(f.at(c / 2, -a - c / 2), 'N', { from: 9 });
    g.text(f.at(c / 2, -a / 2), 'O', { from: 9 });
    g.equal('AB·BC = □AC', f.len * dist(B, C), c * c);
    g.equal('gnomon MNO = square AE', area([A, C, F, L, P, H]), f.len ** 2);
    g.equal('□CD = 5 □AD', dist(C, D) ** 2, 5 * dist(A, D) ** 2);
  },
});
