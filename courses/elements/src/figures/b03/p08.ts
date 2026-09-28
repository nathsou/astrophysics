import { figure } from '../../geometry/figure';
import { dist, lc, reflect, v } from '../../geometry/vec';
import { need } from './lib';

// From a point D outside a circle: of the lines to the concave (far) circumference, DA through the
// centre is greatest; of those to the convex (near) circumference, DG is least; nearer to these
// means greater (resp. less); equal lines come in pairs DK, DB. N is a would-be third (drag it).
export default figure({
  jitter: 0.04,
  build(g) {
    const M = g.point('M', v(0, 0));
    const k = g.circle(M, 2);
    const D = g.free('D', 3.6, 0.25);
    need(dist(D, M) > 2.6, 'D well outside the circle');
    const [Gp, Ap] = lc(D, M, k);
    const A = g.point('A', Ap);
    const G = g.point('G', Gp);
    const rad = Math.PI / 180;
    const E = g.glider('E', k, 162 * rad);
    const F = g.glider('F', k, 132 * rad);
    const C = g.glider('C', k, 104 * rad);
    const near = (P: typeof E) => {
      const [x, y] = lc(D, P, k);
      need(dist(y, P) < 1e-6 && dist(x, y) > 0.05, 'the line from D must meet the far circumference');
      return x;
    };
    const K = g.point('K', near(E));
    const L = g.point('L', near(F));
    const H = g.point('H', near(C));
    const B = g.point('B', reflect(K, D, M));
    const N = g.glider('N', k, -38 * rad);
    for (const P of [A, E, F, C]) g.segment(D, P);
    for (const P of [E, F, C, K, L, H, B]) g.segment(M, P, { aux: true });
    g.segment(D, B);
    g.segment(D, N, { dashed: true });
    const da = dist(D, A), de = dist(D, E), df = dist(D, F), dc = dist(D, C);
    const dg = dist(D, G), dk = dist(D, K), dl = dist(D, L), dh = dist(D, H);
    g.claim('DA > DE > DF > DC', da > de && de > df && df > dc);
    g.claim('DG < DK < DL < DH', dg < dk && dk < dl && dl < dh);
    g.equal('DK = DB', dk, dist(D, B));
    g.claim('DN ≠ DK', Math.abs(dist(D, N) - dk) > 1e-9);
  },
});
