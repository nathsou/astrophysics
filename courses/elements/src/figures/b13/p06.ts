import { figure } from '../../geometry/figure';
import { dist, goldenCut, v } from '../../geometry/vec';

// A rational line AB (the slider gives it a whole number of units) cut in extreme and mean ratio at
// C, with AD = ½AB set out beyond A as in XIII.1. Both segments AC and CB turn out irrational.
export default figure({
  build(g) {
    const n = g.param('n', 4, { min: 1, max: 6, label: 'AB (units)' });
    const A = g.point('A', v(0, 0));
    const B = g.point('B', v(n, 0));
    const C = g.point('C', goldenCut(A, B));
    const D = g.point('D', v(-n / 2, 0));
    g.segment(D, A, { aux: true });
    g.segment(A, B, { aux: true, ticks: 1 });
    g.segment(A, C, { colour: 'red' });
    g.segment(C, B, { colour: 'blue' });
    const s5 = Math.sqrt(5);
    g.equal('□CD = 5 □DA', dist(C, D) ** 2, 5 * dist(D, A) ** 2);
    g.equal('AC = AB·(√5 − 1)/2', dist(A, C), (n * (s5 - 1)) / 2);
    g.equal('CB = AB·(3 − √5)/2', dist(C, B), (n * (3 - s5)) / 2);
    g.show('CD ÷ DA = √5', (dist(C, D) / dist(D, A)).toFixed(6));
  },
});
