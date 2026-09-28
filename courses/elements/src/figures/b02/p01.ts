import { figure } from '../../geometry/figure';
import { add, area, dist, ll, mul, sub } from '../../geometry/vec';
import { below, frame } from './lib';

// a(b + c + d) = ab + ac + ad. The straight line A is a slider; BC is cut at D and E, which glide.
export default figure({
  build(g) {
    const a = g.param('a', 1.4, { min: 0.4, max: 2.6, label: 'A' });
    const B = g.free('B', -2, 1);
    const C = g.free('C', 2.6, 1);
    const D = g.glider('D', [B, C], 0.3);
    const E = g.glider('E', [D, C], 0.45);
    const dn = below(B, C);
    const f = frame(B, C);
    // the line A, set out beside BG so the two can be compared
    const a0 = f(-0.7, 0);
    const a1 = add(a0, mul(dn, a));
    g.segment(a0, a1, { name: 'A' });
    g.text(f(-1.05, a / 2), 'A');
    const F = g.point('F', add(B, mul(dn, a + 0.55)));
    const G = g.point('G', add(B, mul(dn, a)));
    g.segment(B, C);
    g.segment(B, F, { aux: true });
    const H = g.point('H', ll(G, add(G, sub(C, B)), C, add(C, dn)));
    const K = g.point('K', ll(G, H, D, add(D, dn)));
    const L = g.point('L', ll(G, H, E, add(E, dn)));
    g.segment(G, H);
    g.segment(D, K);
    g.segment(E, L);
    g.segment(C, H);
    g.segment(B, G);
    g.angle(C, B, G, { right: true });
    const BH = g.polygon([B, C, H, G], { name: 'BH', aux: true });
    const BK = g.polygon([B, D, K, G], { name: 'BK', fill: true });
    const DL = g.polygon([D, E, L, K], { name: 'DL', fill: true });
    const EH = g.polygon([E, C, H, L], { name: 'EH', fill: true });
    g.equal('A·BC = A·BD + A·DE + A·EC', a * dist(B, C), a * dist(B, D) + a * dist(D, E) + a * dist(E, C));
    g.equal('BH = BK + DL + EH', area(BH), area(BK) + area(DL) + area(EH));
    g.equal('BH = A·BC', area(BH), a * dist(B, C));
  },
});
