import { figure } from '../../geometry/figure';
import { add, along, dist, foot, lc, perp, sub, v } from '../../geometry/vec';
import { need } from './lib';

// Of chords, the diameter is greatest, and the nearer to the centre is greater than the more remote.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 2, { name: 'ABCD' });
    const A = g.point('A', v(-2, 0));
    const D = g.point('D', v(2, 0));
    const rad = Math.PI / 180;
    const B = g.glider('B', k, 78 * rad);
    const C = g.glider('C', k, -45 * rad);
    const F = g.glider('F', k, 240 * rad);
    const G = g.glider('G', k, 292 * rad);
    const H = g.point('H', foot(E, B, C));
    const K = g.point('K', foot(E, F, G));
    need(dist(E, K) > dist(E, H) + 0.02, 'FG more remote than BC');
    const L = g.point('L', along(E, K, dist(E, H)));
    const [p, q] = lc(L, add(L, perp(sub(K, E))), k);
    const [Mp, Np] = p.y > q.y ? [p, q] : [q, p];
    const M = g.point('M', Mp);
    const N = g.point('N', Np);
    g.segment(A, D);
    g.segment(B, C);
    g.segment(F, G);
    g.segment(M, N);
    g.segment(E, H);
    g.segment(E, K);
    for (const P of [M, N, F, G]) g.segment(E, P, { aux: true });
    g.angle(B, H, E, { right: true });
    g.angle(F, K, E, { right: true });
    const bc = dist(B, C);
    g.equal('MN = BC (III.14)', dist(M, N), bc);
    g.claim('AD > BC > FG', dist(A, D) > bc && bc > dist(F, G));
  },
});
