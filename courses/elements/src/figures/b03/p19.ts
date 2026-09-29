import { figure } from '../../geometry/figure';
import { add, collinear, mul, perp, sub, unit, v } from '../../geometry/vec';
import { degAt, onC } from './lib';

// The perpendicular to a tangent at the point of contact passes through the centre. F is a would-be
// centre off CA (drag it): the angle FCE is then never right.
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = g.circle(O, 2);
    const C = g.glider('C', k, (-90 * Math.PI) / 180);
    const A = g.point('A', sub(mul(O, 2), C));
    const t = unit(perp(sub(C, O)));
    const D = g.point('D', add(C, mul(t, -2.4)));
    const E = g.point('E', add(C, mul(t, 2.4)));
    g.point('B', onC(k, (150 * Math.PI) / 180));
    const F = g.free('F', 0.8, 0.3);
    g.segment(D, E);
    g.segment(C, A);
    g.segment(C, F, { dashed: true });
    g.angle(A, C, E, { right: true });
    g.claim('the centre lies on AC', collinear(O, A, C));
    g.claim('∠FCE ≠ 90°', Math.abs(degAt(F, C, E) - 90) > 1e-7);
    g.show('∠FCE', `${degAt(F, C, E).toFixed(1)}°`);
    void D;
  },
});
