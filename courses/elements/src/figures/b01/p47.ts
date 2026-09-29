import { figure } from '../../geometry/figure';
import { add, area, dist, foot, ll, sub, v, type V } from '../../geometry/vec';

export default figure({
  build(g) {
    const B = g.free('B', -1.5, 0);
    const C = g.free('C', 1.5, 0);
    // A glides on the semicircle on BC, so the angle BAC stays right (III.31).
    const M = v((B.x + C.x) / 2, (B.y + C.y) / 2);
    const A = g.glider('A', { c: M, r: dist(B, C) / 2 }, Math.PI * 0.62 + Math.atan2(C.y - B.y, C.x - B.x));
    const sq = (p: V, q: V): [V, V] => {
      // the square on PQ on the right of P→Q
      const d = sub(q, p);
      const n = v(d.y, -d.x);
      return [add(q, n), add(p, n)];
    };
    const [E, D] = sq(B, C);
    const [F, G] = sq(A, B);
    const [H, K] = sq(C, A);
    const P = g.points({ D, E, F, G, H, K });
    const L = g.point('L', ll(A, add(A, sub(D, B)), D, E));
    g.polygon([B, P.D, P.E, C], { fill: true });
    g.polygon([A, B, P.F, P.G], { fill: true });
    g.polygon([C, A, P.H, P.K], { fill: true });
    g.polygon([A, B, C]);
    g.segment(A, L, { aux: true });
    g.segment(A, P.D, { aux: true });
    g.segment(P.F, C, { aux: true });
    g.segment(A, P.E, { aux: true });
    g.segment(B, P.K, { aux: true });
    const X = foot(A, B, C);
    g.polygon([B, P.D, L, X], { name: 'BL', aux: true });
    g.polygon([X, L, P.E, C], { name: 'CL', aux: true });
    g.angle(B, A, C, { right: true });
    const a2 = dist(B, C) ** 2;
    g.equal('□BC = □BA + □AC', a2, dist(B, A) ** 2 + dist(A, C) ** 2);
    g.equal('▱BL = □GB', area([B, P.D, L, X]), dist(A, B) ** 2);
  },
});
