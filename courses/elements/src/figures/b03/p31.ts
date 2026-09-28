import { figure } from '../../geometry/figure';
import { add, mul, sub, v } from '../../geometry/vec';
import { degAt, need, onArc } from './lib';

// Thales: the angle in a semicircle is right; in a greater segment it is acute, in a lesser one
// obtuse. Drag A round the semicircle: the angle BAC stays right. Drag D along the lesser arc AC.
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 2, { name: 'ABCD' });
    const rad = Math.PI / 180;
    const B = g.glider('B', k, 185 * rad);
    const C = g.point('C', sub(mul(E, 2), B));
    const A = g.glider('A', k, 112 * rad);
    const D = g.glider('D', k, 45 * rad);
    need(onArc(E, C, B, A), 'A on the semicircle BAC');
    need(onArc(E, C, A, D), 'D on the arc AC not containing B');
    const F = g.point('F', add(A, mul(sub(A, B), 0.45)));
    g.segment(B, C);
    g.path(B, A, C);
    g.path(A, D, C);
    g.segment(A, E, { aux: true });
    g.segment(A, F, { aux: true });
    g.angle(B, A, C, { right: true });
    g.angle(A, B, C);
    g.angle(A, D, C);
    g.equal('∠BAC = 90°', degAt(B, A, C), 90);
    g.equal('∠BAC = ∠FAC', degAt(B, A, C), degAt(F, A, C));
    g.claim('∠ABC < 90° (greater segment)', degAt(A, B, C) < 90);
    g.claim('∠ADC > 90° (lesser segment)', degAt(A, D, C) > 90);
    g.equal('∠ABC + ∠ADC = 180° (III.22)', degAt(A, B, C) + degAt(A, D, C), 180);
  },
});
