import { figure } from '../../geometry/figure';
import { dist, lc, v, cc } from '../../geometry/vec';
import { need, onC } from './lib';

// Two circles that cut one another have different centres. E is the would-be common centre (drag
// it anywhere inside both circles); the line EFG meets the two circles at different distances.
export default figure({
  build(g) {
    const k1 = { c: v(-0.6, 0), r: 2 };
    const k2 = { c: v(1.0, 0.2), r: 1.7 };
    g.circle(k1.c, k1.r);
    g.circle(k2.c, k2.r);
    const [Cp, Bp] = cc(k1, k2);
    const C = g.point('C', Cp);
    g.point('B', Bp);
    g.point('A', onC(k1, Math.PI));
    g.point('D', onC(k2, (-45 * Math.PI) / 180));
    const E = g.free('E', 0.45, -0.1);
    need(dist(E, k1.c) < k1.r && dist(E, k2.c) < k2.r, 'E inside both circles');
    const G = g.glider('G', k2, (15 * Math.PI) / 180);
    need(dist(G, k1.c) > k1.r, 'G outside the first circle');
    const F = g.point('F', lc(E, G, k1)[1]);
    g.segment(E, C);
    g.segment(E, G);
    g.show('EC', dist(E, C).toFixed(3));
    g.show('EF', dist(E, F).toFixed(3));
    g.show('EG', dist(E, G).toFixed(3));
    g.claim('EF < EG, so E is not the centre of both', dist(E, F) < dist(E, G));
  },
});
