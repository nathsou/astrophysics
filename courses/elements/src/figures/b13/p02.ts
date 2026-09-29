import { figure } from '../../geometry/figure';
import { dist, lerp } from '../../geometry/vec';
import { frame } from './lib';

// The square on AB is five times the square on AC, and CD = 2AC. The square AF on AB contains the
// square AH on AC and the gnomon MNO; the square CG is on CD, and BE is drawn through B. Then CD is
// cut in extreme and mean ratio at B.
export default figure({
  build(g) {
    const A = g.free('A', -1.5, 0);
    const Bp = g.free('B', 1.6, 0);
    const f = frame(A, Bp);
    const b = f.len;
    const c = b / Math.sqrt(5);
    const B = Bp;
    const C = g.point('C', lerp(A, B, 1 / Math.sqrt(5)));
    const D = g.point('D', f.at(3 * c, 0));
    const F = g.point('F', f.at(b, b));
    const L = g.point('L', f.at(0, b));
    const H = g.point('H', f.at(c, c));
    const K = g.point('K', f.at(c, 2 * c));
    const G = g.point('G', f.at(3 * c, -2 * c));
    const E = g.point('E', f.at(b, -2 * c));
    const a0c = f.at(0, c);
    const bc = f.at(b, c);
    const b2c = f.at(b, 2 * c);
    const cb = f.at(c, b);
    const c2c = f.at(c, -2 * c);
    g.polygon([C, B, b2c, K], { aux: true, name: 'KB' });
    g.polygon([C, B, bc, H], { aux: true, name: ['BH', 'HB'] });
    g.polygon([a0c, H, cb, L], { aux: true, name: 'LH' });
    g.polygon([H, bc, F, cb], { aux: true, name: ['HF', 'FH'] });
    g.polygon([C, B, F, L, a0c, H], { fill: true, name: 'MNO' });
    g.polygon([A, C, H, a0c], { name: 'AH' });
    g.polygon([C, D, G, c2c], { name: 'CG' });
    g.polygon([B, D, G, E], { fill: true });
    g.polygon([A, B, F, L]);
    g.segment(A, D);
    g.segment(A, F, { aux: true });
    g.segment(B, E);
    g.text(f.at(c / 2, (b + c) / 2), 'M', { from: 4 });
    g.text(f.at((b + c) / 2, (b + c) / 2), 'N', { from: 4 });
    g.text(f.at((b + c) / 2, c / 2), 'O', { from: 4 });
    const CB = dist(C, B);
    const BD = dist(B, D);
    g.equal('□AB = 5 □AC', dist(A, B) ** 2, 5 * dist(A, C) ** 2);
    g.equal('CD·DB = □CB', dist(C, D) * BD, CB * CB);
    g.claim('CB > BD', CB > BD);
    g.claim('2 AC > CB (the lemma)', 2 * dist(A, C) > CB);
  },
});
