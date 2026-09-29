import { figure } from '../../geometry/figure';
import { add, angle, deg, dist, ll, mid, mul, sub } from '../../geometry/vec';
import { below } from './lib';

// AD² + DB² = 2(AC² + CD²), i.e. (h + x)² + (h − x)² = 2(h² + x²), proved with right isosceles triangles.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, 0);
    const B = g.free('B', 2.2, 0);
    const C = g.point('C', mid(A, B));
    const D = g.glider('D', [C, B], 0.4);
    const h = dist(A, C);
    const up = mul(below(A, B), -1);
    const E = g.point('E', add(C, mul(up, h)));
    const F = g.point('F', ll(D, add(D, up), E, B));
    const G = g.point('G', ll(F, add(F, sub(B, A)), C, E));
    g.segment(A, B);
    g.segment(C, E);
    g.segment(E, A);
    g.segment(E, B);
    g.segment(D, F);
    g.segment(F, G);
    g.segment(A, F);
    g.angle(A, C, E, { right: true });
    g.angle(F, D, B, { right: true });
    g.angle(A, E, B, { right: true });
    const ad = dist(A, D);
    const db = dist(D, B);
    const cd = dist(C, D);
    g.equal('AD² + DB² = 2(AC² + CD²)', ad * ad + db * db, 2 * (h * h + cd * cd));
    g.equal('∠AEB = 90°', deg(angle(A, E, B)), 90);
    g.equal('EG = GF', dist(E, G), dist(G, F));
    g.equal('FD = DB', dist(F, D), db);
    g.equal('AF² = AD² + DF²', dist(A, F) ** 2, ad * ad + dist(D, F) ** 2);
  },
});
