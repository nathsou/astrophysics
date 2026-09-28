import { figure } from '../../geometry/figure';
import { add, dist, mid, mul, perp, sub, unit, v, type V } from '../../geometry/vec';
import { arc3, dirOf, need } from './lib';

// Similar segments on equal bases are equal. The segments AEB and CFD admit the same angle (the
// slider) and stand on equal bases (D glides on the circle about C of radius AB). The dashed curve
// CGD is the "awry" fit of the superposition argument: it would have to meet CFD a third time.
export default figure({
  build(g) {
    const th = g.param('angle', 118, { min: 95, max: 160, step: 1, label: 'angle in the segments (°)' });
    const A = g.free('A', -3.4, -0.6);
    const B = g.free('B', -0.6, -0.9);
    const L = dist(A, B);
    need(L > 0.5, 'AB not too short');
    const C = g.free('C', 0.8, -0.6);
    const D = g.glider('D', { c: C, r: L }, (8 * Math.PI) / 180);
    // the apex of a segment on PQ admitting the angle th: height (PQ/2)·cot(th/2)
    const apex = (P: V, Q: V) => add(mid(P, Q), mul(unit(perp(sub(Q, P))), (dist(P, Q) / 2) / Math.tan((th * Math.PI) / 360)));
    const E = g.point('E', apex(A, B));
    const F = g.point('F', apex(C, D));
    const k1 = arc3(g, A, E, B);
    const k2 = arc3(g, C, F, D);
    g.segment(A, B);
    g.segment(C, D);
    // the awry curve: the arc CFD pushed out and in radially
    const a0 = dirOf(k2.c, C);
    let a1 = dirOf(k2.c, D);
    while (a1 > a0) a1 -= 2 * Math.PI;
    const at = (s: number) => {
      const t = a0 + (a1 - a0) * s;
      const rr = k2.r + 0.09 * L * Math.sin(2 * Math.PI * s);
      return v(k2.c.x + rr * Math.cos(t), k2.c.y + rr * Math.sin(t));
    };
    const ss = [...Array.from({ length: 61 }, (_, i) => i / 60), 0.25].sort((p, q) => p - q);
    g.curve(ss.map(at), { dashed: true });
    g.point('G', at(0.25));
    g.equal('AB = CD', L, dist(C, D));
    g.equal('radius of AEB = radius of CFD', k1.r, k2.r);
    const seg = (k: { r: number }, P: V, Q: V) => {
      const phi = 2 * Math.asin(Math.min(1, dist(P, Q) / (2 * k.r)));
      return (k.r * k.r * (phi - Math.sin(phi))) / 2; // the angle is obtuse: the lesser segment
    };
    g.equal('segment AEB = segment CFD (area)', seg(k1, A, B), seg(k2, C, D));
  },
});
