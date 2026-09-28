import { figure } from '../../geometry/figure';
import { add, area, dot, sub, type V } from '../../geometry/vec';

// Triangles on the same base in the same parallels. A fixes the upper parallel; D glides along it.
// EBCA and DBCF are the parallelograms of the proof (BE ∥ CA, CF ∥ BD), each twice its triangle.
export default figure({
  build(g) {
    const B = g.free('B', -1.5, -1.1);
    const C = g.free('C', 1.5, -1.1);
    const A = g.free('A', -0.7, 1.4);
    const bc = sub(C, B);
    const D = g.glider('D', [A, add(A, bc)], 0.6, { line: true });
    const E = g.point('E', sub(add(A, B), C));
    const F = g.point('F', add(D, bc));
    const k = (p: V) => dot(sub(p, A), bc);
    const tops = [A, D, E, F];
    g.segment(tops.reduce((m, p) => (k(p) < k(m) ? p : m)), tops.reduce((m, p) => (k(p) > k(m) ? p : m)));
    g.segment(B, C);
    g.polygon([E, B, C, A], { aux: true });
    g.polygon([D, B, C, F], { aux: true });
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, B, C], { fill: true });
    g.equal('△ABC = △DBC', area([A, B, C]), area([D, B, C]));
    g.equal('▱EBCA = ▱DBCF', area([E, B, C, A]), area([D, B, C, F]));
    g.equal('▱EBCA = 2 △ABC', area([E, B, C, A]), 2 * area([A, B, C]));
  },
});
