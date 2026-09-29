import { figure } from '../../geometry/figure';
import { angle, deg, v } from '../../geometry/vec';
import { inscribeEquiangular } from './lib';

// Inscribing a triangle equiangular with DEF: the tangent GH at A, and the chords AC, AB making
// with it the angles DEF and DFE (tangent–chord angle, III.32).
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = g.circle(O, 1.9);
    const A = g.glider('A', k, Math.PI / 2);
    const D = g.free('D', 3.6, 1.8);
    const E = g.free('E', 3.0, -1.3);
    const F = g.free('F', 6.1, -0.8);
    const t = inscribeEquiangular(k, A, angle(D, E, F), angle(D, F, E));
    const G = g.point('G', t.G);
    const H = g.point('H', t.H);
    const B = g.point('B', t.left);
    const C = g.point('C', t.right);
    g.segment(G, H);
    g.polygon([A, B, C]);
    g.polygon([D, E, F]);
    g.angle(H, A, C);
    g.angle(G, A, B);
    g.equal('∠ABC = ∠DEF', deg(angle(A, B, C)), deg(angle(D, E, F)));
    g.equal('∠ACB = ∠DFE', deg(angle(A, C, B)), deg(angle(D, F, E)));
    g.equal('∠BAC = ∠EDF', deg(angle(B, A, C)), deg(angle(E, D, F)));
  },
});
