import { figure } from '../../geometry/figure';
import { add, dist, mid, mul, perp, sub, unit } from '../../geometry/vec';
import { arc3, degAt, need, secondHit } from './lib';

// Two similar segments cannot stand on the same line on the same side unless they coincide. With
// ACB inside ADB, the line ACD makes ∠ACB an exterior angle of the triangle CDB, so ∠ACB > ∠ADB:
// the two segments do not admit equal angles. Drag D along the outer arc.
export default figure({
  build(g) {
    const A = g.free('A', -2, 0);
    const B = g.free('B', 2, 0);
    const m = mid(A, B);
    const n = unit(perp(sub(B, A)));
    const L = dist(A, B);
    const k1 = arc3(g, A, add(m, mul(n, 0.3 * L)), B);
    const k2 = arc3(g, A, add(m, mul(n, 0.64 * L)), B, { dashed: true });
    const D = g.glider('D', k2, (60 * Math.PI) / 180);
    need(Math.sign((D.x - A.x) * n.x + (D.y - A.y) * n.y) > 0 && dist(D, A) > 0.1 * L && dist(D, B) > 0.1 * L, 'D on the arc ADB');
    const C = g.point('C', secondHit(A, D, k1));
    g.segment(A, B);
    g.segment(A, D);
    g.segment(C, B);
    g.segment(D, B);
    g.angle(A, C, B);
    g.angle(A, D, B);
    g.claim('∠ACB > ∠ADB (I.16)', degAt(A, C, B) > degAt(A, D, B));
    g.show('∠ACB', `${degAt(A, C, B).toFixed(1)}°`);
    g.show('∠ADB', `${degAt(A, D, B).toFixed(1)}°`);
  },
});
