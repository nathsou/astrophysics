import { figure } from '../../geometry/figure';
import { dist, ll, regular, v } from '../../geometry/vec';

// The regular pentagon ABCDE in its circle; the diagonals AC and BE, which subtend the angles at B
// and A, meet at H. Each is cut in extreme and mean ratio at H, and the greater segments HE, HC are
// equal to the side.
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = g.circle(O, 2);
    const A = g.glider('A', k, Math.PI / 2);
    const t = Math.atan2(A.y, A.x);
    const [, B, C, D, E] = regular(O, 2, 5, t);
    const P = g.points({ B, C, D, E });
    const H = g.point('H', ll(A, P.C, P.B, P.E));
    g.polygon([A, P.B, P.C, P.D, P.E], { fill: true });
    g.segment(A, P.C);
    g.segment(P.B, P.E);
    const side = dist(A, P.B);
    g.equal('BE : EH = EH : HB', dist(P.B, P.E) / dist(P.E, H), dist(P.E, H) / dist(H, P.B));
    g.equal('HE = AB', dist(H, P.E), side);
    g.equal('AC : CH = CH : HA', dist(A, P.C) / dist(P.C, H), dist(P.C, H) / dist(H, A));
    g.equal('CH = AB', dist(P.C, H), side);
    g.show('BE ÷ AB = φ', (dist(P.B, P.E) / side).toFixed(6));
  },
});
