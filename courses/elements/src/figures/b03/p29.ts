import { figure } from '../../geometry/figure';
import { dist, rotAbout } from '../../geometry/vec';
import { arcLen, ccw, dirOf, need, onC } from './lib';

// In equal circles, equal arcs are subtended by equal chords. B, C and E glide; F is placed so
// that the arc EHF equals the arc BGC.
export default figure({
  build(g) {
    const r = g.param('r', 1.5, { min: 1, max: 2, label: 'radius of both circles' });
    const K = g.free('K', -2.1, 0);
    const L = g.free('L', 2.1, 0);
    need(dist(K, L) > 2 * r + 0.1, 'the circles apart');
    const k1 = g.circle(K, r);
    const k2 = g.circle(L, r);
    const rad = Math.PI / 180;
    const B = g.glider('B', k1, 215 * rad);
    const C = g.glider('C', k1, 330 * rad);
    const th = ccw(dirOf(K, B), dirOf(K, C));
    need(th > 0.1 && th < 2 * Math.PI - 0.1, 'B and C apart');
    const E = g.glider('E', k2, 200 * rad);
    const F = g.point('F', rotAbout(E, L, th));
    g.point('G', onC(k1, dirOf(K, B) + th / 2));
    g.point('H', onC(k2, dirOf(L, E) + th / 2));
    g.point('A', onC(k1, dirOf(K, B) + th / 2 + Math.PI));
    g.point('D', onC(k2, dirOf(L, E) + th / 2 + Math.PI));
    g.segment(B, C);
    g.segment(E, F);
    g.path(B, K, C, { aux: true });
    g.path(E, L, F, { aux: true });
    g.equal('arc BGC = arc EHF', arcLen(k1, B, C), arcLen(k2, E, F));
    g.equal('BC = EF', dist(B, C), dist(E, F));
  },
});
