import { figure } from '../../geometry/figure';
import { add, angle, area, ll, mid, mul, rad, rot, side, sub, unit, v } from '../../geometry/vec';

// A parallelogram equal to a triangle, in a given angle. The given angle D is drawn apart (its size
// is the slider); E bisects BC; EF makes the angle CEF equal to D and meets the parallel AG to BC
// through A at F; CG is parallel to EF.
export default figure({
  build(g) {
    const A = g.free('A', -0.9, 2.1);
    const B = g.free('B', -2.6, -0.7);
    const C = g.free('C', 2.2, -0.7);
    const th = rad(g.param('angle', 68, { min: 25, max: 155, step: 1, label: 'angle D' }));
    const D = g.free('D', 4.1, -0.7);
    const d1 = add(D, v(1.3, 0));
    const d2 = add(D, mul(v(Math.cos(th), Math.sin(th)), 1.3));
    g.segment(D, d1);
    g.segment(D, d2);
    g.angle(d1, D, d2, { name: 'D' });
    const E = g.point('E', mid(B, C));
    const s = side(B, C, A) || 1;
    const dir = rot(unit(sub(C, E)), s * th);
    const bc = sub(C, B);
    const F = g.point('F', ll(E, add(E, dir), A, add(A, bc)));
    const G = g.point('G', ll(A, add(A, bc), C, add(C, dir)));
    g.polygon([A, B, C]);
    g.segment(A, E);
    g.segment(A, G, { aux: true });
    g.segment(F, A, { aux: true });
    g.polygon([F, E, C, G], { fill: true });
    g.angle(C, E, F);
    g.equal('▱FECG = △ABC', area([F, E, C, G]), area([A, B, C]));
    g.equal('∠CEF = D', angle(C, E, F), th);
  },
});
