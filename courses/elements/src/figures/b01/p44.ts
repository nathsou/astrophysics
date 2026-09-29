import { figure } from '../../geometry/figure';
import { add, angle, area, dist, ll, mul, rad, rot, sub, unit, v } from '../../geometry/vec';

// Application of areas. AB is the given line, C the given triangle (drag its apex), D the given
// angle (the slider). BEFG is the parallelogram of I.42 equal to C in the angle EBG = D, placed with
// BE in line with AB: I.42 gives it on half the triangle's base, so BE is that half. FG is produced
// to H on the parallel to BG through A; HB meets FE produced at K; the parallel KL to EA through K
// meets HA, GB produced at L, M. The complement LB, on AB, is the answer.
export default figure({
  build(g) {
    const A = g.free('A', -3.2, 0.2);
    const B = g.free('B', -0.2, 0.2);
    // the given triangle C (apex draggable) and the given angle D
    const t1 = v(2.4, 1.1);
    const t2 = v(4.4, 1.1);
    const Cp = g.free('C', 3.1, 2.8);
    const tri = [t1, t2, Cp];
    g.polygon(tri, { name: 'C', fill: true });
    const th = rad(g.param('angle', 62, { min: 30, max: 150, step: 1, label: 'angle D' }));
    const Dp = g.free('D', 2.5, -1.5);
    const d1 = add(Dp, v(1.3, 0));
    const d2 = add(Dp, mul(v(Math.cos(th), Math.sin(th)), 1.3));
    g.segment(Dp, d1);
    g.segment(Dp, d2);
    g.angle(d1, Dp, d2, { name: 'D' });
    // I.42's parallelogram, moved so that BE lies on AB produced
    const S = area(tri);
    const u = unit(sub(B, A));
    const e = dist(t1, t2) / 2;
    const w = rot(u, th);
    const bg = S / (e * Math.sin(th));
    const E = g.point('E', add(B, mul(u, e)));
    const G = g.point('G', add(B, mul(w, bg)));
    const F = g.point('F', add(E, sub(G, B)));
    const H = g.point('H', ll(F, G, A, add(A, w)));
    const K = g.point('K', ll(H, B, F, E));
    const L = g.point('L', ll(K, add(K, u), H, A));
    const M = g.point('M', ll(K, add(K, u), G, B));
    g.polygon([H, F, K, L]);
    g.polygon([B, E, F, G], { fill: true });
    g.polygon([L, M, B, A], { fill: true });
    g.polygon([A, B, G, H], { aux: true });
    g.polygon([M, K, E, B], { aux: true });
    g.segment(H, K, { aux: true });
    g.equal('▱LB = triangle C', area([L, M, B, A]), S);
    g.equal('▱BF = triangle C', area([B, E, F, G]), S);
    g.equal('∠ABM = D', angle(A, B, M), th);
  },
});
