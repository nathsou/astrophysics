import { figure } from '../../geometry/figure';
import { add, area, dist, dot, ll, sub, type V } from '../../geometry/vec';

// Shearing. BC is the common base; A fixes the upper parallel, and D = A + BC. E glides along the
// upper parallel (drag it past A or D), and F = E + BC. The two parallelograms keep equal areas.
// G, where BE crosses DC, exists in Heath's case (D between A and E); in the other cases it is
// hidden.
export default figure({
  build(g) {
    const B = g.free('B', -2.6, -1.1);
    const C = g.free('C', 0.6, -1.1);
    const A = g.free('A', -2.2, 1.3);
    const bc = sub(C, B);
    const D = g.point('D', add(A, bc));
    const E = g.glider('E', [A, D], 1.45, { line: true });
    const F = g.point('F', add(E, bc));
    // G: BE ∩ DC, shown only when it lies on both segments
    let Gp: V = D;
    let inside = false;
    try {
      Gp = ll(B, E, D, C);
      const t1 = dot(sub(Gp, B), sub(E, B)) / dot(sub(E, B), sub(E, B));
      const t2 = dot(sub(Gp, D), sub(C, D)) / dot(sub(C, D), sub(C, D));
      inside = t1 > 1e-9 && t1 < 1 - 1e-9 && t2 > 1e-9 && t2 < 1 - 1e-9;
    } catch {
      inside = false;
    }
    const G = g.point('G', Gp, { hidden: !inside });
    // the upper parallel, from the leftmost to the rightmost of A, D, E, F
    const tops = [A, D, E, F];
    const k = (p: V) => dot(sub(p, A), bc);
    const lo = tops.reduce((m, p) => (k(p) < k(m) ? p : m));
    const hi = tops.reduce((m, p) => (k(p) > k(m) ? p : m));
    g.segment(lo, hi);
    g.polygon([A, B, C, D], { fill: true });
    g.polygon([E, B, C, F], { fill: true });
    if (inside) g.polygon([D, G, E], { aux: true });
    const s1 = area([A, B, C, D]);
    const s2 = area([E, B, C, F]);
    g.equal('▱ABCD = ▱EBCF', s1, s2);
    g.equal('EB = FC', dist(E, B), dist(F, C));
    g.equal('△EAB = △FDC', area([E, A, B]), area([F, D, C]));
    g.show('area of each', s1.toFixed(3));
    void G;
  },
});
