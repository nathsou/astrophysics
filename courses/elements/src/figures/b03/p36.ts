import { figure } from '../../geometry/figure';
import { dist, foot, lc, v } from '../../geometry/vec';
import { degAt, need, tangentPoints } from './lib';

// Secant and tangent from an outside point: AD·DC = DB². This is Heath's second case (DCA not
// through the centre E; F is the foot of the perpendicular from E). Drag D or A.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const r = 2;
    const k = g.circle(E, r);
    const D = g.free('D', 4.2, 0.9);
    need(dist(D, E) > r * 1.12, 'D outside the circle');
    const A = g.glider('A', k, (140 * Math.PI) / 180);
    const [x, y] = lc(D, A, k);
    need(dist(y, A) < 1e-6 && dist(x, y) > 0.05, 'the line DA cuts the circle, A being the far point');
    const C = g.point('C', x);
    const B = g.point('B', tangentPoints(D, k)[1]);
    const F = g.point('F', foot(E, A, C));
    g.segment(D, A);
    g.segment(D, B, { colour: 'red' });
    g.segment(E, F, { aux: true });
    g.segment(E, B, { aux: true });
    g.segment(E, C, { aux: true });
    g.segment(E, D, { aux: true });
    g.angle(E, B, D, { right: true });
    g.angle(E, F, C, { right: true });
    g.equal('AD·DC = DB²', dist(A, D) * dist(D, C), dist(D, B) ** 2);
    g.equal('∠EBD = 90°', degAt(E, B, D), 90);
  },
});
