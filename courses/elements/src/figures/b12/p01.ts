import { figure } from '../../geometry/figure';
import { angle, area, deg, dist, polar, v } from '../../geometry/vec';

// Similar polygons ABCDE, FGHKL inscribed in circles; BM, GN diameters. The second polygon is
// the first one's angular pattern placed in the second circle, turned so that G sits where the
// reader drags it: the polygons stay similar however they are dragged.
export default figure({
  build(g) {
    const c1 = v(-2.4, 0);
    const c2 = v(2.2, -0.35);
    const r1 = 1.75;
    const r2 = 1.15;
    const k1 = g.circle(c1, r1);
    // the pattern of the pentagon ABCDE: angles of A, B, C, D, E on its circle
    const A = g.glider('A', k1, 1.75);
    const B = g.glider('B', k1, 3.05);
    const C = g.glider('C', k1, 4.1);
    const D = g.glider('D', k1, 5.25);
    const E = g.glider('E', k1, 0.45);
    const t = (p: typeof A) => Math.atan2(p.y - c1.y, p.x - c1.x);
    const k2 = g.circle(c2, r2);
    const G = g.glider('G', k2, 3.25);
    const tG = Math.atan2(G.y - c2.y, G.x - c2.x);
    const at = (p: typeof A) => polar(c2, r2, tG + t(p) - t(B));
    const F = g.point('F', at(A));
    const H = g.point('H', at(C));
    const K = g.point('K', at(D));
    const L = g.point('L', at(E));
    const M = g.point('M', polar(c1, r1, t(B) + Math.PI));
    const N = g.point('N', polar(c2, r2, tG + Math.PI));
    const P1 = [A, B, C, D, E];
    const P2 = [F, G, H, K, L];
    g.polygon(P1, { fill: true });
    g.polygon(P2, { fill: true });
    g.segment(B, M, { aux: true });
    g.segment(G, N, { aux: true });
    g.segment(B, E, { aux: true });
    g.segment(A, M, { aux: true });
    g.segment(G, L, { aux: true });
    g.segment(F, N, { aux: true });
    g.equal('∠AEB = ∠AMB', deg(angle(A, E, B)), deg(angle(A, M, B)));
    g.equal('∠BAM = 90°', deg(angle(B, A, M)), 90);
    g.equal('BM : GN = BA : GF', dist(B, M) / dist(G, N), dist(B, A) / dist(G, F));
    g.equal('ABCDE : FGHKL = □BM : □GN', area(P1) / area(P2), dist(B, M) ** 2 / dist(G, N) ** 2);
  },
});
