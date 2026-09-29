import { figure } from '../../geometry/figure';
import { add, angle, deg, dist, ll, mid, mul, sub } from '../../geometry/vec';
import { below } from './lib';

// AD² + DB² = 2(AC² + CD²) with D on AB produced: (2h + x)² + x² = 2(h² + (h + x)²).
export default figure({
  build(g) {
    const A = g.free('A', -2.6, 0.6);
    const B = g.free('B', 0.8, 0.6);
    const C = g.point('C', mid(A, B));
    const D = g.glider('D', [B, add(B, sub(B, A))], 0.4);
    const h = dist(A, C);
    const up = mul(below(A, B), -1);
    const E = g.point('E', add(C, mul(up, h)));
    const F = g.point('F', ll(E, add(E, sub(B, A)), D, add(D, up)));
    const G = g.point('G', ll(E, B, F, D));
    g.segment(A, D);
    g.segment(C, E);
    g.segment(E, A);
    g.segment(E, G);
    g.segment(E, F);
    g.segment(F, G);
    g.segment(A, G);
    g.angle(A, C, E, { right: true });
    g.angle(A, E, G, { right: true });
    g.angle(E, F, G, { right: true });
    const ad = dist(A, D);
    const db = dist(D, B);
    const cd = dist(C, D);
    g.equal('AD² + DB² = 2(AC² + CD²)', ad * ad + db * db, 2 * (h * h + cd * cd));
    g.equal('∠AEB = 90°', deg(angle(A, E, B)), 90);
    g.equal('BD = DG', db, dist(D, G));
    g.equal('GF = EF', dist(G, F), dist(E, F));
    g.equal('AG² = AD² + DG²', dist(A, G) ** 2, ad * ad + dist(D, G) ** 2);
  },
});
