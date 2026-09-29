import { figure } from '../../geometry/figure';
import { add, area, dot, sub, type V } from '../../geometry/vec';

// Triangles on equal bases in the same parallels. E glides along the lower parallel (EF = BC), D
// along the upper one. GBCA and DEFH are the parallelograms of the proof (BG ∥ CA, FH ∥ DE).
export default figure({
  build(g) {
    const B = g.free('B', -3.4, -1.1);
    const C = g.free('C', -1.4, -1.1);
    const A = g.free('A', -2.6, 1.3);
    const bc = sub(C, B);
    const E = g.glider('E', [B, C], 1.6, { line: true });
    const F = g.point('F', add(E, bc));
    const D = g.glider('D', [A, add(A, bc)], 1.75, { line: true });
    const G = g.point('G', sub(add(A, B), C));
    const H = g.point('H', add(D, sub(F, E)));
    const span = (ps: V[], o: V) => {
      const k = (p: V) => dot(sub(p, o), bc);
      return [ps.reduce((m, p) => (k(p) < k(m) ? p : m)), ps.reduce((m, p) => (k(p) > k(m) ? p : m))] as const;
    };
    const [t0, t1] = span([G, A, D, H], A);
    const [b0, b1] = span([B, C, E, F], B);
    g.segment(t0, t1);
    g.segment(b0, b1);
    g.polygon([G, B, C, A], { aux: true });
    g.polygon([D, E, F, H], { aux: true });
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, E, F], { fill: true });
    g.equal('△ABC = △DEF', area([A, B, C]), area([D, E, F]));
    g.equal('▱GBCA = ▱DEFH', area([G, B, C, A]), area([D, E, F, H]));
  },
});
