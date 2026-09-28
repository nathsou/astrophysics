import { figure } from '../../geometry/figure';
import { deg, dist, rotAbout } from '../../geometry/vec';
import { angles, sides, tangentsMeet } from './lib';

// The circumscribed regular pentagon: tangents at the vertices A, …, E of an inscribed one.
export default figure({
  build(g) {
    const F = g.free('F', 0, 0);
    const k = g.circle(F, 1.8);
    const A = g.glider('A', k, Math.PI / 2 + 0.15);
    // the vertices of the inscribed pentagon (IV.11): equal circumferences AB = BC = CD = DE = EA
    const [B, C, D, E] = [1, 2, 3, 4].map((i, j) => g.point('BCDE'[j], rotAbout(A, F, (2 * Math.PI * i) / 5)));
    const H = g.point('H', tangentsMeet(F, A, B));
    const K = g.point('K', tangentsMeet(F, B, C));
    const L = g.point('L', tangentsMeet(F, C, D));
    const M = g.point('M', tangentsMeet(F, D, E));
    const G = g.point('G', tangentsMeet(F, E, A));
    const P = [G, H, K, L, M];
    g.polygon(P);
    g.segment(F, B, { aux: true });
    g.segment(F, K, { aux: true });
    g.segment(F, C, { aux: true });
    g.segment(F, L, { aux: true });
    g.segment(F, D, { aux: true });
    g.angle(F, C, K, { right: true });
    g.angle(K, F, C);
    const s = sides(P);
    const a = angles(P).map(deg);
    g.equal('BK = KC', dist(B, K), dist(K, C));
    g.equal('KC = CL', dist(K, C), dist(C, L));
    g.equal('HK = KL', s[1], s[2]);
    g.equal('GH = HK', s[0], s[1]);
    g.equal('KL = LM = MG', s[2] + s[3], 2 * s[4]);
    g.equal('∠HKL = ∠KLM', a[2], a[3]);
    g.equal('∠MGH = ∠GHK', a[0], a[1]);
    g.equal('∠LMG = ∠HKL', a[4], a[2]);
  },
});
