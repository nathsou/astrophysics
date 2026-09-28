import { figure } from '../../geometry/figure';
import { angle, deg } from '../../geometry/vec';
import { add, coplanar, ground, mul, sph, v3, Z3 } from './lib';

// Only one perpendicular to a plane at a point. The reductio: AB and AC both perpendicular; the
// plane through them meets the plane of reference in DAE, and ∠BAE, ∠CAE would both be right.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.3 },
  build(g) {
    const phi = g.param('phi', 0.35, { min: -0.3, max: 0.9, label: 'direction of DE' });
    const e = g.param('e', 1.2, { min: 0.8, max: 1.45, label: 'slope of AC' });
    ground(g, -2, 2, -1.4, 1.4);
    const d = sph(phi);
    const A = g.point('A', v3(0, 0, 0));
    const B = g.point('B', v3(0, 0, 1.9));
    const C = g.point('C', add(mul(d, 1.9 * Math.cos(e)), mul(Z3, 1.9 * Math.sin(e))));
    const D = g.point('D', mul(d, -1.7));
    const E = g.point('E', mul(d, 1.7));
    g.polygon([D, E, add(E, mul(Z3, 2.1)), add(D, mul(Z3, 2.1))], { fill: true, aux: true });
    g.segment(D, E);
    g.segment(A, B, { colour: 'red' });
    g.segment(A, C, { dashed: true });
    g.angle(B, A, E, { right: true });
    g.equal('∠BAE = 90°', deg(angle(B, A, E)), 90);
    g.claim('B, A, C, D, E in one plane', coplanar([A, B, C, D, E]));
    g.claim('∠CAE ≠ ∠BAE: the second perpendicular AC is impossible', Math.abs(deg(angle(C, A, E)) - 90) > 0.1);
  },
});
