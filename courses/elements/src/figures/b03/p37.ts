import { figure } from '../../geometry/figure';
import { cc, dist, lc, v } from '../../geometry/vec';
import { degAt, need, tangentPoints } from './lib';

// The converse of III.36: if AD·DC = DB², then DB touches the circle. B is placed on the circle at
// distance √(AD·DC) from D (the hypothesis); DE is the tangent drawn for comparison. Drag D or A.
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const r = 2;
    const k = g.circle(F, r);
    const D = g.free('D', 4.2, 0.9);
    need(dist(D, F) > r * 1.12, 'D outside the circle');
    const A = g.glider('A', k, (165 * Math.PI) / 180);
    const [x, y] = lc(D, A, k);
    need(dist(y, A) < 1e-6 && dist(x, y) > 0.05, 'the line DA cuts the circle, A being the far point');
    const C = g.point('C', x);
    const E = g.point('E', tangentPoints(D, k)[0]);
    const [p, q] = cc(k, { c: D, r: Math.sqrt(dist(A, D) * dist(D, C)) });
    const B = g.point('B', dist(p, E) > dist(q, E) ? p : q);
    g.segment(D, A, { name: 'DCA' }); // named, since the text once reads 'the circle ACB; let DCA …' as a circle
    g.segment(D, B, { colour: 'red' });
    g.segment(D, E, { aux: true });
    g.segment(F, E, { aux: true });
    g.segment(F, B, { aux: true });
    g.segment(F, D, { aux: true });
    g.angle(D, E, F, { right: true });
    g.angle(D, B, F, { right: true });
    g.equal('AD·DC = DB² (hypothesis)', dist(A, D) * dist(D, C), dist(D, B) ** 2);
    g.equal('DE = DB', dist(D, E), dist(D, B));
    g.equal('∠DBF = 90°', degAt(D, B, F), 90);
  },
});
