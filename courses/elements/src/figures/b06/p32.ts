import { figure } from '../../geometry/figure';
import { add, angle, collinear, mul, sub } from '../../geometry/vec';

// Triangles ABC, DCE joined at C with AB ∥ DC, AC ∥ DE and AB : AC = DC : DE (DCE is ABC turned
// through two right angles and dilated by k). Then BC and CE are in one straight line.
export default figure({
  build(g) {
    const A = g.free('A', -1.2, 1.4);
    const B = g.free('B', -2.4, -0.6);
    const C = g.free('C', 0, -0.6);
    const k = g.param('k', 0.75, { min: 0.3, max: 1.6, label: 'DC : AB' });
    const D = g.point('D', add(C, mul(sub(A, B), k)));
    const E = g.point('E', add(D, mul(sub(C, A), k)));
    g.polygon([A, B, C], { fill: true });
    g.polygon([D, C, E], { fill: true });
    g.angle(B, A, C);
    g.angle(C, D, E);
    g.equal('∠BAC = ∠CDE', angle(B, A, C), angle(C, D, E));
    g.equal('∠ACE + ∠ACB = two right angles', angle(A, C, E) + angle(A, C, B), Math.PI);
    g.claim('B, C, E in a straight line', collinear(B, C, E));
  },
});
