import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { ccw, degAt, dirOf, need, onArc, onC } from './lib';

// Angles in the same segment are equal. Drag A and E along the segment BAED: the angles BAD and BED
// stay equal, each half of the arc BCD they stand on (measured at the centre F).
export default figure({
  build(g) {
    const F = g.point('F', v(0, 0));
    const k = g.circle(F, 2, { name: 'ABCD' });
    const rad = Math.PI / 180;
    const B = g.glider('B', k, 205 * rad);
    const D = g.glider('D', k, 335 * rad);
    const arc = ccw(dirOf(F, B), dirOf(F, D));
    need(arc > 0.15 && arc < 2 * Math.PI - 0.15, 'B and D apart');
    g.point('C', onC(k, dirOf(F, B) + arc / 2));
    const A = g.glider('A', k, 118 * rad);
    const E = g.glider('E', k, 58 * rad);
    need(onArc(F, D, B, A) && onArc(F, D, B, E), 'A and E stay in the segment BAED');
    g.path(B, A, D);
    g.path(B, E, D);
    g.segment(B, D, { aux: true });
    g.path(B, F, D, { aux: true });
    g.angle(B, A, D);
    g.angle(B, E, D);
    const a = degAt(B, A, D);
    g.equal('∠BAD = ∠BED', a, degAt(B, E, D));
    g.equal('arc BCD (at the centre) = 2∠BAD', (arc * 180) / Math.PI, 2 * a);
  },
});
