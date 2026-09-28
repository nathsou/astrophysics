import { figure } from '../../geometry/figure';
import { add, angle, area, cross2, dist, mul, rad, rot, sub, unit, v } from '../../geometry/vec';

// A parallelogram equal to any rectilineal figure. ABCD is the given figure (four free vertices),
// E the given angle (the slider). FH is I.42's parallelogram equal to △ABD in the angle HKF = E
// (on half of BD, as I.42 makes it); GM is I.44's parallelogram equal to △DBC applied to GH in the
// angle GHM = E, on the far side of GH. The proof shows that KHM and FGL are straight, so KFLM is
// one parallelogram; the figure checks it.
export default figure({
  build(g) {
    const A = g.free('A', -6.1, 1.4);
    const B = g.free('B', -6.6, -1.3);
    const C = g.free('C', -3.7, -1.6);
    const D = g.free('D', -3.3, 1.1);
    const th = rad(g.param('angle', 64, { min: 30, max: 150, step: 1, label: 'angle E' }));
    const Ep = g.free('E', -2.2, -1.5);
    g.segment(Ep, add(Ep, v(1.2, 0)));
    g.segment(Ep, add(Ep, mul(v(Math.cos(th), Math.sin(th)), 1.2)));
    g.angle(add(Ep, v(1.2, 0)), Ep, add(Ep, mul(v(Math.cos(th), Math.sin(th)), 1.2)), { name: 'E' });
    g.polygon([A, B, C, D], { fill: true });
    g.segment(D, B);
    const S1 = area([A, B, D]);
    const S2 = area([D, B, C]);
    // FH (I.42): base KH = half of BD, side KF at the angle E
    const K = g.free('K', -0.3, -1.5);
    const x = v(1, 0);
    const kh = dist(B, D) / 2;
    const H = g.point('H', add(K, mul(x, kh)));
    const kf = S1 / (kh * Math.sin(th));
    const F = g.point('F', add(K, mul(rot(x, th), kf)));
    const G = g.point('G', add(H, sub(F, K)));
    // GM (I.44): applied to GH, in the angle GHM = E, on the other side of GH from K
    const hg = dist(H, G);
    const toG = unit(sub(G, H));
    const hm = S2 / (hg * Math.sin(th));
    const M = g.point('M', add(H, mul(rot(toG, -th), hm)));
    const L = g.point('L', add(M, sub(G, H)));
    g.polygon([K, H, G, F], { fill: true });
    g.polygon([H, M, L, G], { fill: true });
    g.polygon([K, M, L, F], { aux: true });
    g.equal('▱KFLM = ABCD', area([K, M, L, F]), area([A, B, C, D]));
    g.equal('KH, HM in a straight line', cross2(unit(sub(H, K)), unit(sub(M, H))), 0);
    g.equal('FG, GL in a straight line', cross2(unit(sub(G, F)), unit(sub(L, G))), 0);
    g.equal('∠FKM = E', angle(F, K, M), th);
  },
});
