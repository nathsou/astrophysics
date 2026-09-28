import { figure } from '../../geometry/figure';
import { add, dist, lc, mid, perp, sub } from '../../geometry/vec';

// AB, BC in one line; the semicircle ADC on AC; BD perpendicular to AC. Then DB² = AB·BC.
// With BC = 1, DB = √AB: the construction of a square root.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, -0.5);
    const C = g.free('C', 2.2, -0.5);
    const B = g.glider('B', [A, C], 0.68);
    const M = mid(A, C);
    const k = { c: M, r: dist(A, C) / 2 };
    const up = add(B, perp(sub(C, A)));
    const D = g.point('D', lc(B, up, k)[1]);
    g.arc(M, C, A);
    g.segment(A, C);
    g.segment(B, D, { colour: 'red' });
    g.segment(A, D);
    g.segment(D, C);
    g.angle(A, D, C, { right: true });
    g.angle(D, B, C, { right: true });
    g.equal('DB² = AB·BC', dist(D, B) ** 2, dist(A, B) * dist(B, C));
    g.equal('AB : DB = DB : BC', dist(A, B) / dist(D, B), dist(D, B) / dist(B, C));
    g.show('AB, BC', `${dist(A, B).toFixed(3)}, ${dist(B, C).toFixed(3)}`);
    g.show('DB = √(AB·BC)', dist(D, B).toFixed(3));
  },
});
