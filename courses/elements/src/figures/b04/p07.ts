import { figure } from '../../geometry/figure';
import { angle, deg, dist, lc, rotAbout } from '../../geometry/vec';
import { tangentsMeet } from './lib';

// The circumscribed square: tangents at the ends of two perpendicular diameters.
export default figure({
  build(g) {
    const E = g.free('E', 0, 0);
    const A = g.free('A', 0.4, 1.6);
    const k = g.circle(E, A);
    const C = g.point('C', lc(A, E, k)[1]);
    const B = g.point('B', rotAbout(A, E, Math.PI / 2));
    const D = g.point('D', lc(B, E, k)[1]);
    g.segment(A, C);
    g.segment(B, D);
    const F = g.point('F', tangentsMeet(E, D, A));
    const G = g.point('G', tangentsMeet(E, A, B));
    const H = g.point('H', tangentsMeet(E, B, C));
    const K = g.point('K', tangentsMeet(E, C, D));
    g.polygon([F, G, H, K], { name: 'GK' });
    g.polygon([A, G, H, C], { name: 'GC', aux: true });
    g.polygon([A, F, K, C], { name: 'AK', aux: true });
    g.polygon([F, G, B, D], { name: 'FB', aux: true });
    g.polygon([B, H, K, D], { name: 'BK', aux: true });
    g.angle(A, E, B, { right: true });
    g.angle(E, A, G, { right: true });
    g.equal('FG = GH', dist(F, G), dist(G, H));
    g.equal('HK = KF', dist(H, K), dist(K, F));
    g.equal('GH = AC', dist(G, H), dist(A, C));
    g.equal('∠AGB = 90°', deg(angle(A, G, B)), 90);
    g.equal('∠GHK = 90°', deg(angle(G, H, K)), 90);
  },
});
