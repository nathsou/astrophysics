import { figure } from '../../geometry/figure';
import { add, dist, v } from '../../geometry/vec';
import { rod } from './lib';

// AB : CD = E : F. AG = F and CH = E are raised at right angles; the rectangles BG = AB·F and DH = CD·E are equal.
export default figure({
  build(g) {
    const ab = g.param('AB', 2, { min: 0.8, max: 2.6 });
    const cd = g.param('CD', 1.2, { min: 0.5, max: 2.2 });
    const e = g.param('E', 1.3, { min: 0.5, max: 2 });
    const f = (e * cd) / ab;
    const A = g.point('A', v(-3, 0));
    const B = g.point('B', add(A, v(ab, 0)));
    const Gp = g.point('G', add(A, v(0, f)));
    const C = g.point('C', v(0.2, 0));
    const D = g.point('D', add(C, v(cd, 0)));
    const H = g.point('H', add(C, v(0, e)));
    g.polygon([A, B, add(B, v(0, f)), Gp], { fill: true });
    g.polygon([C, D, add(D, v(0, e)), H], { fill: true });
    g.angle(B, A, Gp, { right: true });
    g.angle(D, C, H, { right: true });
    rod(g, 'E', v(-2.6, -0.8), e, { colour: 'red' });
    rod(g, 'F', v(-2.6, -1.3), f, { colour: 'blue' });
    g.equal('AB : CD = E : F', ab / cd, e / f);
    g.equal('AB·F = CD·E', ab * dist(A, Gp), cd * dist(C, H));
  },
});
