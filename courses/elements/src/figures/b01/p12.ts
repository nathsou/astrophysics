import { figure } from '../../geometry/figure';
import { Degenerate, add, angle, deg, dist, lc, mid, mul, side, sub, unit } from '../../geometry/vec';

// I.12: D is any point on the other side of the infinite line AB from C; the circle about C
// through D cuts AB at E and G, and H is the midpoint of EG (I.10).
export default figure({
  build(g) {
    const A = g.free('A', -3.4, 0);
    const B = g.free('B', 3.4, 0.1);
    const C = g.free('C', 0.3, 1.6);
    const D = g.free('D', 0.9, -0.75);
    if (side(A, B, C) * side(A, B, D) >= 0) throw new Degenerate('D must be on the other side of AB');
    g.line(A, B);
    const k = g.circle(C, D, { aux: true });
    const [E, G] = lc(A, B, k);
    g.points({ E, G });
    const H = g.point('H', mid(E, G));
    g.point('F', add(C, mul(unit(sub(H, C)), k.r)));
    g.segment(C, G);
    g.segment(C, H);
    g.segment(C, E);
    g.angle(C, H, G, { right: true });
    g.equal('∠CHG = 90°', deg(angle(C, H, G)), 90);
    g.equal('CG = CE', dist(C, G), dist(C, E));
  },
});
