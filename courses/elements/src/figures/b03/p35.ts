import { figure } from '../../geometry/figure';
import { dist, foot, v } from '../../geometry/vec';
import { need, secondHit } from './lib';

// Intersecting chords: AE·EC = DE·EB. Drag E, A or B: both products change together, and both
// always equal r² − FE² (the power of E, up to sign).
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const r = 2;
    const k = g.circle(F, r);
    const E = g.free('E', 0.85, -0.75);
    need(dist(E, F) < r * 0.93, 'E inside the circle');
    const rad = Math.PI / 180;
    const A = g.glider('A', k, 158 * rad);
    const B = g.glider('B', k, 72 * rad);
    need(dist(A, E) > 0.1 && dist(B, E) > 0.1, 'A and B away from E');
    const C = g.point('C', secondHit(A, E, k));
    const D = g.point('D', secondHit(B, E, k));
    const G = g.point('G', foot(F, A, C));
    const H = g.point('H', foot(F, D, B));
    g.segment(A, C);
    g.segment(B, D);
    g.segment(F, G, { aux: true });
    g.segment(F, H, { aux: true });
    g.segment(F, B, { aux: true });
    g.segment(F, C, { aux: true });
    g.segment(F, E, { aux: true });
    g.angle(F, G, C, { right: true });
    const p1 = dist(A, E) * dist(E, C);
    g.equal('AE·EC = DE·EB', p1, dist(D, E) * dist(E, B));
    g.equal('AE·EC = FB² − FE²', p1, r * r - dist(F, E) ** 2);
  },
});
