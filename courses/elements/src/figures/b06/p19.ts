import { figure } from '../../geometry/figure';
import { add, area, dist, mul, sub } from '../../geometry/vec';

// Similar triangles ABC, DEF (DEF is ABC dilated by k and moved). BG is the third proportional to BC, EF.
export default figure({
  build(g) {
    const A = g.free('A', -2.4, 1.2);
    const B = g.free('B', -3, -0.8);
    const C = g.free('C', -0.4, -0.8);
    const k = g.param('k', 0.7, { min: 0.3, max: 0.95, label: 'EF : BC' });
    const E = g.free('E', 0.6, -0.8);
    const D = g.point('D', add(E, mul(sub(A, B), k)));
    const F = g.point('F', add(E, mul(sub(C, B), k)));
    const bg = dist(E, F) ** 2 / dist(B, C);
    const G = g.point('G', add(B, mul(sub(C, B), bg / dist(B, C))));
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, E, F], { fill: true });
    g.segment(A, G, { aux: true });
    const r = dist(B, C) / dist(E, F);
    g.equal('△ABC : △DEF = (BC : EF)²', area([A, B, C]) / area([D, E, F]), r * r);
    g.equal('△ABG = △DEF', area([A, B, G]), area([D, E, F]));
    g.equal('BC : EF = EF : BG', dist(B, C) / dist(E, F), dist(E, F) / dist(B, G));
  },
});
