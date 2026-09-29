import { figure } from '../../geometry/figure';
import { add, collinear, mul, sub } from '../../geometry/vec';

// From ABCD a parallelogram AF = AEFG, similar and similarly situated, with the common angle DAB.
// Its corner F always lies on the diameter AC, which is what the reductio proves.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, 1.2);
    const B = g.free('B', -2.8, -1.2);
    const D = g.free('D', 1.6, 1.2);
    const C = g.point('C', add(B, sub(D, A)));
    const E = g.glider('E', [A, B], 0.5);
    const t = Math.hypot(E.x - A.x, E.y - A.y) / Math.hypot(B.x - A.x, B.y - A.y);
    const Gp = g.point('G', add(A, mul(sub(D, A), t)));
    const F = g.point('F', add(E, sub(Gp, A)));
    g.polygon([A, B, C, D]);
    g.polygon([A, E, F, Gp], { fill: true });
    g.segment(A, C, { dashed: true });
    g.claim('F lies on the diameter AC', collinear(A, F, C));
  },
  unresolved: {
    H: 'the supposed point where a diameter missing F would cut GF produced; the proof shows it is F itself',
    K: 'the foot of the parallel through the supposed H; it would coincide with E',
    AHC: 'the supposed diameter through H, which cannot differ from AC',
    KG: 'the parallelogram about the supposed diameter, which cannot exist',
    HK: 'the parallel through the supposed H, which cannot exist',
    AK: 'a side of the impossible parallelogram KG; it would equal AE',
  },
});
