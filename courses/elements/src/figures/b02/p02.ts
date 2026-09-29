import { figure } from '../../geometry/figure';
import { add, area, dist, ll } from '../../geometry/vec';
import { below, frame } from './lib';

// (a + b)·a + (a + b)·b = (a + b)²: the square on AB is cut by CF into the two rectangles.
export default figure({
  build(g) {
    const A = g.free('A', -2, 1.8);
    const B = g.free('B', 2, 1.8);
    const C = g.glider('C', [A, B], 0.62);
    const s = dist(A, B);
    const f = frame(A, B);
    const dn = below(A, B);
    const { D, E } = g.points({ D: f(0, s), E: f(s, s) });
    const F = g.point('F', ll(C, add(C, dn), D, E));
    const sq = g.polygon([A, D, E, B], { name: 'AE' });
    g.segment(C, F);
    const AF = g.polygon([A, C, F, D], { name: 'AF', fill: true });
    const CE = g.polygon([C, B, E, F], { name: 'CE' });
    g.equal('AB² = AB·BC + BA·AC', s * s, s * dist(B, C) + s * dist(A, C));
    g.equal('AE = AF + CE', area(sq), area(AF) + area(CE));
    g.equal('AF = BA·AC', area(AF), s * dist(A, C));
  },
});
