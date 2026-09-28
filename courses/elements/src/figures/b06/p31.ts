import { figure } from '../../geometry/figure';
import { add, area, dist, foot, mid, mul, perp, sub, type V } from '../../geometry/vec';

// A glides on the semicircle on BC, so the angle BAC stays right. On each side stands a triangle of
// the same shape (the sliders set the shape), so the three figures are similar and similarly described.
export default figure({
  build(g) {
    const B = g.free('B', -1.8, 0);
    const C = g.free('C', 1.8, 0);
    const u = g.param('u', 0.35, { min: 0.1, max: 0.9, label: 'apex position' });
    const h = g.param('h', 0.55, { min: 0.2, max: 1.2, label: 'apex height' });
    const M = mid(B, C);
    const A = g.glider('A', { c: M, r: dist(B, C) / 2 }, 2 + Math.atan2(C.y - B.y, C.x - B.x));
    const D = g.point('D', foot(A, B, C));
    // the figure on PQ, outward (away from R)
    const on = (p: V, q: V, r: V): V[] => {
      let n = mul(perp(sub(q, p)), h);
      const apex = add(add(p, mul(sub(q, p), u)), n);
      if (dist(apex, r) < dist(add(add(p, mul(sub(q, p), u)), mul(n, -1)), r)) {
        n = mul(n, -1);
        return [p, q, add(add(p, mul(sub(q, p), u)), n)];
      }
      return [p, q, apex];
    };
    const fBC = on(C, B, A);
    const fBA = on(B, A, C);
    const fAC = on(A, C, B);
    g.polygon(fBC, { fill: true });
    g.polygon(fBA, { fill: true });
    g.polygon(fAC, { fill: true });
    g.polygon([A, B, C]);
    g.segment(A, D, { aux: true });
    g.angle(B, A, C, { right: true });
    g.equal('fig. on BC = fig. on BA + fig. on AC', area(fBC), area(fBA) + area(fAC));
    g.equal('CB : BD = fig. on CB : fig. on BA', dist(C, B) / dist(B, D), area(fBC) / area(fBA));
  },
});
