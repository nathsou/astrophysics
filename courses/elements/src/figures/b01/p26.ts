import { figure } from '../../geometry/figure';
import { add, angle, dist, lerp, ll, rot, side, sub, unit } from '../../geometry/vec';

// ASA. The data are the triangle ABC and the side EF (E free, F on the circle about E with radius
// BC, so EF = BC). D is then *constructed* from the hypothesis: the angles DEF and EFD are made
// equal to ABC and BCA, and D is where their arms meet. G and H are the points of the two
// reductios (BG = DE with G ≠ A, BH = EF with H ≠ C): they cannot exist, so they are drawn at a
// supposed position with dashed joins.
export default figure({
  build(g) {
    const A = g.free('A', -3.3, 1.7);
    const B = g.free('B', -4.4, -1);
    const C = g.free('C', -0.9, -1);
    const E = g.free('E', 1.1, -1);
    const F = g.glider('F', { c: E, r: dist(B, C) }, 0.04);
    const s = side(B, C, A);
    const u = unit(sub(F, E));
    const dirE = rot(u, s * angle(A, B, C));
    const dirF = rot(sub(E, F), -s * angle(B, C, A));
    const D = g.point('D', ll(E, add(E, dirE), F, add(F, dirF)));
    g.polygon([A, B, C]);
    g.polygon([D, E, F]);
    g.angle(A, B, C);
    g.angle(B, C, A);
    g.angle(D, E, F);
    g.angle(E, F, D);
    // the impossible points of the two reductios
    const G = g.point('G', lerp(B, A, 0.72));
    const H = g.point('H', lerp(B, C, 0.76));
    g.segment(G, C, { dashed: true });
    g.segment(A, H, { dashed: true });
    g.equal('AB = DE', dist(A, B), dist(D, E));
    g.equal('AC = DF', dist(A, C), dist(D, F));
    g.equal('∠BAC = ∠EDF', angle(B, A, C), angle(E, D, F));
  },
});
