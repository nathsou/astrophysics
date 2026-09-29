import { figure } from '../../geometry/figure';
import { add, area, dist, ll } from '../../geometry/vec';
import { below } from './lib';

// (a + b)·b = a·b + b²: the rectangle AB, BC is cut by CD into the rectangle AC, CB and the square on CB.
export default figure({
  build(g) {
    const A = g.free('A', -2, 1.8);
    const B = g.free('B', 2, 1.8);
    const C = g.glider('C', [A, B], 0.55);
    const b = dist(C, B);
    const dn = below(A, B);
    const D = g.point('D', add(C, { x: dn.x * b, y: dn.y * b }));
    const E = g.point('E', add(B, { x: dn.x * b, y: dn.y * b }));
    const F = g.point('F', ll(E, D, A, add(A, dn)));
    g.segment(A, B);
    g.segment(D, F);
    g.segment(A, F);
    const AE = g.polygon([A, B, E, F], { name: 'AE', aux: true });
    const AD = g.polygon([A, C, D, F], { name: 'AD', fill: true });
    const CE = g.polygon([C, D, E, B], { name: 'CE' });
    g.polygon([C, D, E, B], { name: 'DB', aux: true });
    g.equal('AB·BC = AC·CB + CB²', dist(A, B) * b, dist(A, C) * b + b * b);
    g.equal('AE = AD + CE', area(AE), area(AD) + area(CE));
    g.equal('AE = AB·BC', area(AE), dist(A, B) * b);
  },
});
