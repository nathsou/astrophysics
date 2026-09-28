import { figure } from '../../geometry/figure';
import { add, dist, ll, mul, sub, unit } from '../../geometry/vec';

// The third proportional CE to AB, AC: BD = AC is laid off on AB produced, and DE ∥ BC.
export default figure({
  build(g) {
    const A = g.free('A', 0, 1.6);
    const B = g.free('B', -0.6, 0.6);
    const C = g.free('C', 0.9, 0.8);
    const D = g.point('D', add(B, mul(unit(sub(B, A)), dist(A, C))));
    const E = g.point('E', ll(D, add(D, sub(C, B)), A, C));
    g.segment(A, D);
    g.segment(A, E);
    g.segment(B, C);
    g.segment(D, E, { colour: 'red' });
    g.equal('AB : AC = AC : CE', dist(A, B) / dist(A, C), dist(A, C) / dist(C, E));
    g.show('CE = AC² / AB', dist(C, E).toFixed(3));
  },
});
