import { figure } from '../../geometry/figure';
import { add, dist, foot, goldenCut, lc, lerp, mid, mul, perp, regular, sub, unit } from '../../geometry/vec';

// The five sides compared. AB is the diameter of the sphere; C bisects it and AD = 2DB. On the
// semicircle AEB, CE and DF are perpendicular to AB: AF is the side of the pyramid, BF of the cube,
// BE of the octahedron. AG = AB at right angles to AB; GC meets the semicircle at H, HK is
// perpendicular to AB, CL = CK and LM is perpendicular to AB: MB is the side of the icosahedron.
// FB cut in extreme and mean ratio at N gives NB, the side of the dodecahedron. On the right, the
// pentagon of the lemma.
export default figure({
  build(g) {
    const A = g.free('A', -2.2, -1);
    const B = g.free('B', 2.2, -1);
    const d = dist(A, B);
    const n = perp(unit(sub(B, A)));
    const C = g.point('C', mid(A, B));
    const D = g.point('D', lerp(A, B, 2 / 3));
    const k = { c: C, r: d / 2 };
    const up = (p: typeof A) => add(p, mul(n, Math.sqrt(Math.max(0, (d / 2) ** 2 - dist(p, C) ** 2))));
    const E = g.point('E', up(C));
    const F = g.point('F', up(D), { labelDir: 110 });
    const G = g.point('G', add(A, mul(n, d)));
    const H = g.point('H', lc(G, C, k)[0]);
    const K = g.point('K', foot(H, A, B));
    const L = g.point('L', add(C, mul(unit(sub(B, A)), dist(C, K))));
    const M = g.point('M', up(L), { labelDir: 40 });
    const N = g.point('N', goldenCut(B, F));
    g.arc(C, B, A);
    g.segment(A, B);
    g.segment(C, E, { aux: true });
    g.segment(D, F, { aux: true });
    g.segment(A, G, { aux: true });
    g.segment(G, C, { aux: true });
    g.segment(H, K, { aux: true });
    g.segment(L, M, { aux: true });
    g.segment(A, F, { colour: 'red' });
    g.segment(B, E, { colour: 'blue' });
    g.segment(F, B, { colour: 'yellow' });
    g.segment(M, B, { colour: 'black' });
    g.segment(N, B, { colour: 'red', dashed: true });
    // the lemma: a regular pentagon ABCDE with centre F, drawn apart
    const pc = add(B, add(mul(unit(sub(B, A)), 1.9), mul(n, 0.95)));
    const pent = regular(pc, 0.95, 5, Math.atan2(n.y, n.x));
    g.circle(pc, 0.95, { aux: true, from: 50 });
    g.polygon(pent, { from: 50, name: 'ABCDE' });
    ['FA', 'FC', 'FD', 'FE'].forEach((nm, i) => g.segment(pc, pent[[0, 2, 3, 4][i]], { aux: true, from: 50, name: nm }));
    g.segment(pc, pent[1], { aux: true, from: 50 });
    const sq = (x: number) => (x / d) ** 2;
    g.equal('□AF = ⅔ □AB (pyramid)', sq(dist(A, F)), 2 / 3);
    g.equal('□BE = ½ □AB (octahedron)', sq(dist(B, E)), 1 / 2);
    g.equal('□BF = ⅓ □AB (cube)', sq(dist(B, F)), 1 / 3);
    g.equal('□KL = ⅕ □AB (radius of the icosahedron’s circle)', sq(dist(K, L)), 1 / 5);
    g.equal('MB = side of the icosahedron', dist(M, B) / d, Math.sqrt((5 - Math.sqrt(5)) / 10));
    g.equal('NB = side of the dodecahedron', dist(N, B) / d, (Math.sqrt(15) - Math.sqrt(3)) / 6);
    g.claim('AF > BE > BF > MB > NB', dist(A, F) > dist(B, E) && dist(B, E) > dist(B, F) && dist(B, F) > dist(M, B) && dist(M, B) > dist(N, B));
    g.show('sides ÷ diameter', [dist(A, F), dist(B, E), dist(B, F), dist(M, B), dist(N, B)].map((x) => (x / d).toFixed(4)).join(', '));
  },
});
