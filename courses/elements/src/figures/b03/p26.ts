import { figure } from '../../geometry/figure';
import { dist, rotAbout } from '../../geometry/vec';
import { arcLen, ccw, degAt, dirOf, need, onArc, onC } from './lib';

// In equal circles, equal angles (at the centres or at the circumferences) stand on equal arcs.
// B, C and E glide; F is placed so that the angle EHF equals BGC. A and D glide on the other arcs.
export default figure({
  build(g) {
    const r = g.param('r', 1.5, { min: 1, max: 2, label: 'radius of both circles' });
    const G = g.free('G', -2.1, 0);
    const H = g.free('H', 2.1, 0);
    need(dist(G, H) > 2 * r + 0.1, 'the circles apart');
    const k1 = g.circle(G, r);
    const k2 = g.circle(H, r);
    const rad = Math.PI / 180;
    const B = g.glider('B', k1, 225 * rad);
    const C = g.glider('C', k1, 320 * rad);
    const th = ccw(dirOf(G, B), dirOf(G, C));
    need(th > 0.1 && th < Math.PI - 0.1, 'the arc BC less than a semicircle');
    const E = g.glider('E', k2, 210 * rad);
    const F = g.point('F', rotAbout(E, H, th));
    const A = g.glider('A', k1, 100 * rad);
    const D = g.glider('D', k2, 80 * rad);
    need(onArc(G, C, B, A) && onArc(H, F, E, D), 'A and D on the greater arcs');
    const K = g.point('K', onC(k1, dirOf(G, B) + th / 2));
    const L = g.point('L', onC(k2, dirOf(H, E) + th / 2));
    g.path(B, G, C);
    g.path(E, H, F);
    g.path(B, A, C);
    g.path(E, D, F);
    g.segment(B, C, { aux: true });
    g.segment(E, F, { aux: true });
    g.angle(B, G, C);
    g.angle(E, H, F);
    void K;
    void L;
    g.equal('∠BAC = ∠EDF', degAt(B, A, C), degAt(E, D, F));
    g.equal('BC = EF', dist(B, C), dist(E, F));
    g.equal('arc BKC = arc ELF', arcLen(k1, B, C), arcLen(k2, E, F));
  },
});
