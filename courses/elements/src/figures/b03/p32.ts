import { figure } from '../../geometry/figure';
import { add, mul, perp, sub, unit, v, side } from '../../geometry/vec';
import { degAt, need, onArc } from './lib';

// The tangent–chord angle equals the angle in the alternate segment. EF touches the circle at B;
// BA is the diameter through B. Drag B, D or C.
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = g.circle(O, 2);
    const rad = Math.PI / 180;
    const B = g.glider('B', k, -90 * rad);
    const A = g.point('A', sub(mul(O, 2), B));
    const D = g.glider('D', k, 12 * rad);
    const C = g.glider('C', k, -38 * rad);
    need(Math.abs(side(B, A, D)) > 0 && Math.abs(Math.hypot(D.x - B.x, D.y - B.y)) > 0.2, 'D off the diameter and away from B');
    need(onArc(O, B, D, A) ? onArc(O, D, B, C) : onArc(O, B, D, C), 'C on the arc BD not containing A');
    const t = unit(perp(sub(B, O)));
    const s = side(B, A, add(B, t)) === side(B, A, D) ? 1 : -1;
    const F = g.point('F', add(B, mul(t, 2.6 * s)));
    const E = g.point('E', add(B, mul(t, -2.6 * s)));
    g.segment(E, F);
    g.segment(B, D);
    g.segment(B, A, { aux: true });
    g.path(B, A, D);
    g.path(D, C, B);
    g.angle(F, B, D);
    g.angle(B, A, D);
    g.angle(D, B, E);
    g.angle(D, C, B);
    g.equal('∠FBD = ∠BAD', degAt(F, B, D), degAt(B, A, D));
    g.equal('∠EBD = ∠DCB', degAt(E, B, D), degAt(D, C, B));
  },
});
