import { figure } from '../../geometry/figure';
import { dist, ll, v } from '../../geometry/vec';
import { need } from './lib';

// Two chords not through the centre cannot bisect each other.
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const k = g.circle(F, 2);
    const A = g.glider('A', k, (150 * Math.PI) / 180);
    const B = g.glider('B', k, (235 * Math.PI) / 180);
    const C = g.glider('C', k, (15 * Math.PI) / 180);
    const D = g.glider('D', k, (95 * Math.PI) / 180);
    const Ep = ll(A, C, B, D);
    need(dist(Ep, F) < 1.95, 'the chords cross inside the circle');
    const E = g.point('E', Ep);
    g.segment(A, C);
    g.segment(B, D);
    g.segment(F, E, { dashed: true });
    const ae = dist(A, E), ec = dist(E, C), be = dist(B, E), ed = dist(E, D);
    g.show('AE : EC', (ae / ec).toFixed(3));
    g.show('BE : ED', (be / ed).toFixed(3));
    g.claim('not both bisected', Math.abs(ae - ec) > 1e-9 || Math.abs(be - ed) > 1e-9);
  },
});
