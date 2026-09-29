import { figure } from '../../geometry/figure';
import { along, dist, lc, v } from '../../geometry/vec';
import { need, onC } from './lib';

// Two circles that touch have different centres. The circle CDE lies inside ABC and touches it at
// C; F is the would-be common centre (drag it), and FEB is a line drawn from it at random.
export default figure({
  build(g) {
    const O = v(0, 0);
    const R = 2.2;
    const k1 = { c: O, r: R };
    g.circle(O, R);
    const C = g.point('C', onC(k1, (-60 * Math.PI) / 180));
    const r = 1.25;
    const k2 = { c: along(O, C, R - r), r };
    g.circle(k2.c, r);
    g.point('A', onC(k1, (200 * Math.PI) / 180));
    g.point('D', onC(k2, (-150 * Math.PI) / 180));
    const F = g.free('F', 0.35, -0.4);
    need(dist(F, k2.c) < r * 0.97, 'F inside the inner circle');
    const B = g.glider('B', k1, (110 * Math.PI) / 180);
    const E = g.point('E', lc(F, B, k2)[1]);
    g.segment(F, C);
    g.segment(F, B);
    g.show('FC', dist(F, C).toFixed(3));
    g.show('FE', dist(F, E).toFixed(3));
    g.show('FB', dist(F, B).toFixed(3));
    g.claim('FE < FB, so F is not the centre of both', dist(F, E) < dist(F, B));
  },
});
