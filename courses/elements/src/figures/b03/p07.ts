import { figure } from '../../geometry/figure';
import { dist, lerp, v } from '../../geometry/vec';
import { onC } from './lib';

// From a point F of a diameter (not the centre): FA is the greatest line to the circle, FD the
// least, the nearer to FA is greater than the more remote, and equal lines come in pairs FG, FH
// symmetric about the diameter. K is the would-be third line equal to FG (drag it).
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 2, { name: 'ABCD' });
    const A = g.point('A', v(-2, 0));
    const D = g.point('D', v(2, 0));
    const F = g.glider('F', [lerp(E, D, 0.08), lerp(E, D, 0.92)], 0.45);
    const rad = Math.PI / 180;
    const B = g.glider('B', k, 150 * rad);
    const C = g.glider('C', k, 110 * rad);
    const G = g.glider('G', k, 48 * rad);
    const H = g.point('H', v(G.x, -G.y));
    const K = g.glider('K', k, -125 * rad);
    g.segment(A, D);
    for (const P of [B, C, G, H]) {
      g.segment(F, P);
      g.segment(E, P, { aux: true });
    }
    g.segment(F, K, { dashed: true });
    g.angle(G, E, F);
    g.angle(F, E, H);
    const fa = dist(F, A), fb = dist(F, B), fc = dist(F, C), fg = dist(F, G), fd = dist(F, D);
    g.claim('FA > FB > FC > FG > FD', fa > fb && fb > fc && fc > fg && fg > fd);
    g.equal('FG = FH', fg, dist(F, H));
    g.claim('FK ≠ FG', Math.abs(dist(F, K) - fg) > 1e-9);
    void onC;
  },
});
