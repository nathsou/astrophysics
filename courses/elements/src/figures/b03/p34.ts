import { figure } from '../../geometry/figure';
import { add, mul, perp, rot, sub, unit, v } from '../../geometry/vec';
import { degAt, need, onArc, secondHit } from './lib';

// From a given circle, cut off a segment admitting a given angle D: draw the tangent EF at B and
// make ∠FBC = ∠D. The segment BAC admits ∠D (III.32). Drag A along it.
export default figure({
  build(g) {
    const th = g.param('D', 55, { min: 15, max: 165, step: 1, label: 'the given angle D (°)' });
    const a = (th * Math.PI) / 180;
    const O = v(0, 0);
    const k = g.circle(O, 2, { name: 'ABC' });
    const D = g.free('D', -4.2, -2.2);
    const arm = 1.1;
    g.segment(D, add(D, v(arm, 0)));
    g.segment(D, add(D, rot(v(arm, 0), a)));
    g.angle(add(D, v(arm, 0)), D, add(D, rot(v(arm, 0), a)));
    const B = g.glider('B', k, (-90 * Math.PI) / 180);
    const t = unit(perp(sub(B, O)));
    const F = g.point('F', add(B, mul(t, 2.5)));
    const E = g.point('E', add(B, mul(t, -2.5)));
    const C = g.point('C', secondHit(B, add(B, rot(t, a)), k));
    const A = g.glider('A', k, (140 * Math.PI) / 180);
    need(onArc(O, C, B, A), 'A in the segment BAC');
    g.segment(E, F);
    g.segment(B, C);
    g.path(B, A, C);
    g.angle(F, B, C);
    g.angle(B, A, C);
    g.equal('∠BAC = ∠D', degAt(B, A, C), th);
    g.equal('∠FBC = ∠D', degAt(F, B, C), th);
  },
});
