import { figure } from '../../geometry/figure';
import { add, area, dist, lc, mid, mul, sub, unit } from '../../geometry/vec';
import { below } from './lib';

// Squaring a rectilineal figure. The pentagon A (drag its corners) is first turned into the
// rectangle BD on the given side BE (I.45); then the mean proportional EH of BE and ED is found
// with the semicircle on BF, and the square on EH equals A.
export default figure({
  build(g) {
    const A1 = g.free('A₁', -6.2, 0.3);
    const A2 = g.free('A₂', -3.9, -0.5);
    const A3 = g.free('A₃', -2.7, 1.1);
    const A4 = g.free('A₄', -3.9, 2.6);
    const A5 = g.free('A₅', -5.8, 2.0);
    const ps = [A1, A2, A3, A4, A5];
    const fig = g.polygon(ps, { name: 'A', fill: true });
    g.text(mid(mid(A1, A3), mid(A4, A5)), 'A');
    const S = area(ps);
    const B = g.free('B', -1.2, 0);
    const E = g.free('E', 2.4, 0);
    const be = dist(B, E);
    const ed = S / be;
    const dn = below(B, E);
    const D = g.point('D', add(E, mul(dn, ed)));
    const Cc = add(B, mul(dn, ed));
    const rect = g.polygon([B, E, D, Cc], { name: 'BD', fill: true });
    const F = g.point('F', add(E, mul(unit(sub(E, B)), ed)));
    const G = g.point('G', mid(B, F));
    g.segment(B, F);
    g.arc(G, F, B);
    const H = g.point('H', lc(D, E, { c: G, r: dist(G, B) })[1]);
    g.segment(E, H);
    g.segment(G, H);
    // the square on EH, drawn beside it
    const eh = dist(E, H);
    const w = mul(unit(sub(F, E)), eh);
    g.polygon([E, add(E, w), add(H, w), H], { aux: true, dashed: true });
    g.equal('BD = A', area(rect), area(fig));
    g.equal('EF = ED', dist(E, F), ed);
    g.equal('BE·EF + EG² = GF²  (II.5)', be * ed + dist(E, G) ** 2, dist(G, F) ** 2);
    g.equal('EH² = A', eh * eh, area(fig));
  },
});
