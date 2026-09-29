import { figure } from '../../geometry/figure';
import { add, angle, area, dist, mid, mul, sub, unit, v } from '../../geometry/vec';
import { simMap } from './lib';

// Given the triangle ABC and the figure D (a quadrilateral whose size is set by the slider), make KGH
// similar to ABC and equal to D. BE = BCEL is a parallelogram on BC equal to ABC (its side BL is half
// of BA); CM = CFME is a parallelogram on CE equal to D, in the same angle. GH is the mean
// proportional between BC and CF (VI.13), and KGH is drawn on GH similar to ABC (VI.18).
export default figure({
  build(g) {
    const A = g.free('A', -2.4, 1.4);
    const B = g.free('B', -3, -0.4);
    const C = g.free('C', -1.1, -0.4);
    const s = g.param('s', 0.8, { min: 0.4, max: 1.3, label: 'size of D' });
    const L = g.point('L', mid(B, A));
    const E = g.point('E', add(C, sub(L, B)));
    const qd = [v(1.2, 1.6), v(2.4, 1.3), v(2.6, 2.3), v(1.5, 2.6)].map((p) => add(v(1.2, 1.6), mul(sub(p, v(1.2, 1.6)), s)));
    const aD = area(qd);
    const height = area([B, C, E, L]) / dist(B, C);
    const cf = aD / height;
    const F = g.point('F', add(C, mul(unit(sub(C, B)), cf)));
    const M = g.point('M', add(F, sub(E, C)));
    const gh = Math.sqrt(dist(B, C) * cf);
    const G = g.point('G', v(0.8, -1.4));
    const H = g.point('H', add(G, v(gh, 0)));
    const K = g.point('K', simMap(B, C, G, H)(A));
    g.polygon([A, B, C], { fill: true });
    g.polygon(qd, { fill: true, name: 'D' });
    g.text(add(qd[0], mul(v(0.5, 0.35), s)), 'D');
    g.polygon([B, C, E, L], { aux: true });
    g.polygon([C, F, M, E], { aux: true });
    g.polygon([K, G, H], { fill: true });
    g.equal('▱BE = △ABC', area([B, C, E, L]), area([A, B, C]));
    g.equal('▱CM = D', area([C, F, M, E]), aD);
    g.equal('BC : GH = GH : CF', dist(B, C) / gh, gh / cf);
    g.equal('△KGH = D', area([K, G, H]), aD);
    g.equal('∠KGH = ∠ABC', angle(K, G, H), angle(A, B, C));
  },
});
