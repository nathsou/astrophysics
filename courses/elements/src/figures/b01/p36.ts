import { figure } from '../../geometry/figure';
import { add, area, cross2, dist, dot, sub, unit, type V } from '../../geometry/vec';

// Equal bases in the same parallels. BC is a base; F glides along the lower parallel and FG = BC.
// A fixes the upper parallel (D = A + BC); E glides along it and EH = BC. EBCH is the auxiliary
// parallelogram of the proof.
export default figure({
  build(g) {
    const B = g.free('B', -3.6, -1.1);
    const C = g.free('C', -1.5, -1.1);
    const A = g.free('A', -3.1, 1.2);
    const bc = sub(C, B);
    const D = g.point('D', add(A, bc));
    const F = g.glider('F', [B, C], 2.05, { line: true });
    const G = g.point('G', add(F, bc));
    const E = g.glider('E', [A, D], 2.4, { line: true });
    const H = g.point('H', add(E, bc));
    const span = (ps: V[], o: V) => {
      const k = (p: V) => dot(sub(p, o), bc);
      return [ps.reduce((m, p) => (k(p) < k(m) ? p : m)), ps.reduce((m, p) => (k(p) > k(m) ? p : m))] as const;
    };
    const [t0, t1] = span([A, D, E, H], A);
    const [b0, b1] = span([B, C, F, G], B);
    g.segment(t0, t1);
    g.segment(b0, b1);
    g.polygon([A, B, C, D], { fill: true });
    g.polygon([E, F, G, H], { fill: true });
    g.polygon([E, B, C, H], { aux: true });
    g.equal('▱ABCD = ▱EFGH', area([A, B, C, D]), area([E, F, G, H]));
    g.equal('EBCH: EH = BC', dist(E, H), dist(B, C));
    g.equal('EB ∥ HC', cross2(unit(sub(E, B)), unit(sub(H, C))), 0);
    g.equal('▱EBCH = ▱ABCD', area([E, B, C, H]), area([A, B, C, D]));
  },
});
