import { figure } from '../../geometry/figure';
import { dist, foot, rotAbout, v } from '../../geometry/vec';
import { dirOf, need } from './lib';

// Equal chords are equally distant from the centre, and conversely. A, B and C glide on the
// circle; D is placed so that the arc CD turns through the same angle as AB, which makes AB = CD.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 2, { name: 'ABDC' });
    const rad = Math.PI / 180;
    const A = g.glider('A', k, 150 * rad);
    const B = g.glider('B', k, 55 * rad);
    need(dist(A, B) > 0.3, 'A and B apart');
    const C = g.glider('C', k, -30 * rad);
    const D = g.point('D', rotAbout(C, E, dirOf(E, B) - dirOf(E, A)));
    const F = g.point('F', foot(E, A, B));
    const G = g.point('G', foot(E, C, D));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(E, F);
    g.segment(E, G);
    g.segment(A, E, { aux: true });
    g.segment(E, C, { aux: true });
    g.angle(A, F, E, { right: true });
    g.angle(C, G, E, { right: true });
    g.equal('AB = CD', dist(A, B), dist(C, D));
    g.equal('EF = EG', dist(E, F), dist(E, G));
  },
});
