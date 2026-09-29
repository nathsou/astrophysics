import { figure } from '../../geometry/figure';
import { area, dist, goldenCut } from '../../geometry/vec';
import { frame } from './lib';

// AB cut in extreme and mean ratio at C (AC greater), and AD = AC laid off beyond A. With the square
// AE on AB, the square CH on AC and the square DH on AD, the rectangle DK (that is, BD·DA) equals
// the square AE: DB is cut in extreme and mean ratio at A.
export default figure({
  build(g) {
    const A = g.free('A', -0.8, -1.4);
    const B = g.free('B', 2.0, -1.4);
    const C = g.point('C', goldenCut(A, B));
    const f = frame(A, B);
    const b = f.len;
    const c = dist(A, C);
    const D = g.point('D', f.at(-c, 0));
    const E = g.point('E', f.at(b, b));
    const H = g.point('H', f.at(0, c));
    const K = g.point('K', f.at(b, c));
    const L = g.point('L', f.at(-c, c));
    const aTop = f.at(0, b);
    const cTop = f.at(c, b);
    const cc = f.at(c, c);
    g.polygon([C, B, E, cTop], { aux: true, name: 'CE' });
    g.polygon([H, K, E, aTop], { aux: true, name: 'HE' });
    g.polygon([A, C, cc, H], { aux: true, name: ['CH', 'HC'] });
    g.polygon([D, B, K, L], { fill: true });
    g.polygon([D, A, H, L]);
    g.polygon([A, B, E, aTop], { name: 'AE' });
    g.segment(D, B);
    g.equal('rectangle BD·DA = □AB', area([D, B, K, L]), b * b);
    g.equal('DB : BA = BA : AD', dist(D, B) / b, b / dist(A, D));
    g.claim('BA > AD', b > dist(A, D));
  },
});
