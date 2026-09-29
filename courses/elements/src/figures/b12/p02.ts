import { figure } from '../../geometry/figure';
import { add, area, dist, polar, rot, sub, v, type V } from '../../geometry/vec';

// Circles ABCD, EFGH with diameters BD, FH. The square EFGH, the octagon EKFLGMHN, and the similar
// octagon AOBPCQDR in the other circle. S is the supposed area, less than the circle EFGH, drawn as
// a dashed circle. The slider keeps doubling the sides (thin polygon), and the readouts show the
// part of the circle left over shrinking below the excess of the circle over S.
export default figure({
  build(g) {
    const c1 = v(-2.3, 0);
    const c2 = v(1.9, -0.3);
    const B = g.free('B', -4.1, 0.15);
    const F = g.free('F', 0.55, -0.2);
    const s = g.param('s', 0.93, { min: 0.8, max: 0.98, label: 'S ÷ circle EFGH' });
    const k = g.param('k', 3, { min: 0, max: 5, label: 'doublings' });
    const r1 = dist(c1, B);
    const r2 = dist(c2, F);
    // A at the top, B left, C bottom, D right: quarter turns from B.
    const q = (c: V, p: V, t: number) => add(c, rot(sub(p, c), t));
    const A = g.point('A', q(c1, B, -Math.PI / 2));
    const C = g.point('C', q(c1, B, Math.PI / 2));
    const D = g.point('D', q(c1, B, Math.PI));
    const E = g.point('E', q(c2, F, -Math.PI / 2));
    const G = g.point('G', q(c2, F, Math.PI / 2));
    const H = g.point('H', q(c2, F, Math.PI));
    // midpoints of the arcs, going A → B → C → D (counter-clockwise): turn by an eighth
    const m = (c: V, p: V) => q(c, p, Math.PI / 4);
    const O = g.point('O', m(c1, A));
    const P = g.point('P', m(c1, B));
    const Q = g.point('Q', m(c1, C));
    const R = g.point('R', m(c1, D));
    const K = g.point('K', m(c2, E));
    const L = g.point('L', m(c2, F));
    const M = g.point('M', m(c2, G));
    const N = g.point('N', m(c2, H));
    g.circle(c1, r1);
    g.circle(c2, r2);
    // the area S: a circle concentric with EFGH, with area s times the circle
    g.circle(c2, r2 * Math.sqrt(s), { dashed: true, aux: true, name: 'S' });
    g.segment(B, D, { aux: true });
    g.segment(F, H, { aux: true });
    g.polygon([A, B, C, D], { aux: true });
    g.polygon([E, F, G, H], { aux: true });
    const oct1 = [A, O, B, P, C, Q, D, R];
    const oct2 = [E, K, F, L, G, M, H, N];
    g.polygon(oct1, { fill: true });
    g.polygon(oct2, { fill: true });
    // further doublings: the regular 2^(k+2)-gon through E
    const n = 4 * 2 ** k;
    const t0 = Math.atan2(E.y - c2.y, E.x - c2.x);
    const poly = (c: V, r: number, t: number, nn: number) => Array.from({ length: nn }, (_, i) => polar(c, r, t + (2 * Math.PI * i) / nn));
    if (k > 1) g.curve(poly(c2, r2, t0, n), { closed: true, aux: true });
    const circ1 = Math.PI * r1 * r1;
    const circ2 = Math.PI * r2 * r2;
    const gap = (nn: number) => circ2 - area(poly(c2, r2, t0, nn));
    g.show(`circle EFGH − ${n}-gon`, gap(n).toFixed(4));
    g.show('circle EFGH − S', (circ2 * (1 - s)).toFixed(4));
    g.claim(`each doubling removes more than half of what is left (${n / 2} → ${n})`, k === 0 || gap(n) < gap(n / 2) / 2);
    g.claim('square EFGH > half the circle', area([E, F, G, H]) > circ2 / 2);
    g.equal('AOBPCQDR : EKFLGMHN = □BD : □FH', area(oct1) / area(oct2), dist(B, D) ** 2 / dist(F, H) ** 2);
    g.equal('circle ABCD : circle EFGH = □BD : □FH', circ1 / circ2, dist(B, D) ** 2 / dist(F, H) ** 2);
  },
  unresolved: { T: 'the area T of the lemma, a fourth proportional that is only supposed' },
});
