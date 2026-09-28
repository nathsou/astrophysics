import { figure } from '../../geometry/figure';
import { area, dist, goldenCut } from '../../geometry/vec';
import { frame } from './lib';

// AB cut in extreme and mean ratio at C (AC greater). In the square ADEB, the diagonal DB and the
// lines through C and F give the square HG on AC, the square CK on BC, the rectangles AK and CE
// (each AB·BC) and the gnomon LMN.
export default figure({
  build(g) {
    const A = g.free('A', -1.6, -1.5);
    const B = g.free('B', 1.6, -1.5);
    const C = g.point('C', goldenCut(A, B));
    const f = frame(A, B);
    const b = f.len;
    const c = dist(A, C);
    const D = g.point('D', f.at(0, b));
    const E = g.point('E', f.at(b, b));
    const F = g.point('F', f.at(c, b - c));
    const G = g.point('G', f.at(c, b));
    const H = g.point('H', f.at(0, b - c));
    const K = g.point('K', f.at(b, b - c));
    g.polygon([A, B, K, H], { aux: true });
    g.polygon([C, B, E, G], { aux: true });
    g.polygon([A, C, F, H], { aux: true });
    g.polygon([F, K, E, G], { aux: true });
    g.polygon([A, B, E, G, F, H], { fill: true, name: 'LMN' });
    g.polygon([C, B, K, F]);
    g.polygon([H, F, G, D]);
    g.polygon([A, B, E, D]);
    g.segment(D, B, { aux: true });
    g.text(f.at(c / 2, (b - c) / 2), 'L', { from: 6 });
    g.text(f.at((b + c) / 2, (b - c) / 2), 'M', { from: 6 });
    g.text(f.at((b + c) / 2, b - c / 2), 'N', { from: 6 });
    g.equal('rectangle AK = square HG', area([A, B, K, H]), area([H, F, G, D]));
    g.equal('□AB + □BC = 3 □AC', b * b + dist(B, C) ** 2, 3 * c * c);
  },
});
