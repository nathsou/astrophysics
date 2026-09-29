import { figure } from '../../geometry/figure';
import { dist, rotAbout } from '../../geometry/vec';
import { arcLen, ccw, degAt, dirOf, need, onArc } from './lib';

// In equal circles, angles standing on equal arcs are equal. B, C and E glide; F is placed so that
// the arc EF equals the arc BC.
export default figure({
  unresolved: {
    K: 'the point of the reductio with ∠BGK = ∠EHF; the proof shows it coincides with C',
    BK: 'the arc cut off by the supposed point K, which coincides with BC',
    BGK: 'the angle of the reductio, which coincides with the angle BGC',
  },
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
    g.path(B, G, C);
    g.path(E, H, F);
    g.path(B, A, C);
    g.path(E, D, F);
    g.angle(B, G, C);
    g.angle(E, H, F);
    g.angle(B, A, C);
    g.angle(E, D, F);
    g.equal('arc BC = arc EF', arcLen(k1, B, C), arcLen(k2, E, F));
    g.equal('∠BGC = ∠EHF', degAt(B, G, C), degAt(E, H, F));
    g.equal('∠BAC = ∠EDF', degAt(B, A, C), degAt(E, D, F));
  },
});
