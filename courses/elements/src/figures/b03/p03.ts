import { figure } from '../../geometry/figure';
import { add, dist, lc, mid, sub, v } from '../../geometry/vec';
import { degAt, need } from './lib';

// A line through the centre bisects a chord if and only if it is perpendicular to it.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 2);
    const A = g.glider('A', k, (200 * Math.PI) / 180);
    const B = g.glider('B', k, (-25 * Math.PI) / 180);
    need(dist(A, B) > 0.3, 'A and B apart');
    const F = g.point('F', mid(A, B));
    need(dist(E, F) > 0.05, 'AB not through the centre');
    // the diameter through F: D on F's side, C opposite
    const [p, q] = lc(E, F, k);
    const D = g.point('D', q);
    const C = g.point('C', p);
    g.segment(A, B);
    g.segment(C, D);
    g.segment(E, A, { aux: true });
    g.segment(E, B, { aux: true });
    g.angle(A, F, E, { right: true });
    g.equal('AF = FB', dist(A, F), dist(F, B));
    g.equal('∠AFE = 90°', degAt(A, F, E), 90);
    g.equal('∠AFE = ∠BFE', degAt(A, F, E), degAt(B, F, E));
    void add;
    void sub;
    void C;
    void D;
  },
});
