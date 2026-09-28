import { figure } from '../../geometry/figure';
import { add, angle, deg, mul, rotAbout, sub } from '../../geometry/vec';
import { tangentsMeet } from './lib';

// Circumscribing a triangle equiangular with DEF: radii KA, KC make with KB the exterior angles
// DEG and DFH, and the tangents at A, B, C form LMN.
export default figure({
  build(g) {
    const K = g.free('K', 0, 0);
    const k = g.circle(K, 1.5);
    const B = g.glider('B', k, -Math.PI / 2);
    const D = g.free('D', 4.6, 1.8);
    const E = g.free('E', 3.9, -1.0);
    const F = g.free('F', 7.2, -0.6);
    const G = g.point('G', add(E, mul(sub(E, F), 0.3)));
    const H = g.point('H', add(F, mul(sub(F, E), 0.3)));
    g.segment(G, H);
    g.polygon([D, E, F]);
    const A = g.point('A', rotAbout(B, K, angle(D, E, G)));
    const C = g.point('C', rotAbout(B, K, -angle(D, F, H)));
    const M = g.point('M', tangentsMeet(K, A, B));
    const N = g.point('N', tangentsMeet(K, B, C));
    const L = g.point('L', tangentsMeet(K, C, A));
    g.polygon([L, M, N]);
    g.segment(K, A);
    g.segment(K, B);
    g.segment(K, C);
    g.angle(K, A, M, { right: true });
    g.angle(K, B, M, { right: true });
    g.angle(K, C, N, { right: true });
    g.angle(B, K, A);
    g.angle(D, E, G);
    g.equal('∠LMN = ∠DEF', deg(angle(L, M, N)), deg(angle(D, E, F)));
    g.equal('∠LNM = ∠DFE', deg(angle(L, N, M)), deg(angle(D, F, E)));
    g.equal('∠MLN = ∠EDF', deg(angle(M, L, N)), deg(angle(E, D, F)));
    g.equal('∠AKB + ∠AMB = 180°', deg(angle(A, K, B) + angle(A, M, B)), 180);
  },
});
