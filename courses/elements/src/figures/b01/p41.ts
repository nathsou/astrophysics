import { figure } from '../../geometry/figure';
import { add, area, dot, sub, type V } from '../../geometry/vec';

// A parallelogram is double a triangle on the same base in the same parallels. ABCD is the
// parallelogram; E glides along the upper parallel AE; AC is the diagonal of the proof.
export default figure({
  build(g) {
    const B = g.free('B', -2.4, -1.1);
    const C = g.free('C', 0.8, -1.1);
    const A = g.free('A', -1.8, 1.3);
    const bc = sub(C, B);
    const D = g.point('D', add(A, bc));
    const E = g.glider('E', [A, D], 1.55, { line: true });
    const k = (p: V) => dot(sub(p, A), bc);
    const tops = [A, D, E];
    g.segment(tops.reduce((m, p) => (k(p) < k(m) ? p : m)), tops.reduce((m, p) => (k(p) > k(m) ? p : m)));
    g.polygon([A, B, C, D], { fill: true });
    g.polygon([E, B, C], { fill: true });
    g.segment(A, C, { aux: true });
    g.equal('▱ABCD = 2 △EBC', area([A, B, C, D]), 2 * area([E, B, C]));
    g.equal('△ABC = △EBC', area([A, B, C]), area([E, B, C]));
  },
});
