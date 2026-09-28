import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, coplanar, cross, ground, isParallel, mul, sph, sub, unit, v3, Z3 } from './lib';

// Two lines perpendicular to the same plane are parallel.
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: -0.35 },
  build(g) {
    const az = g.param('az', 0.25, { min: -0.5, max: 0.8, label: 'direction of BD' });
    const a = g.param('a', 1.5, { min: 0.8, max: 2.2, label: 'AB' });
    const c = g.param('c', 1.9, { min: 0.8, max: 2.4, label: 'CD' });
    ground(g, -2, 2, -1.7, 1.5);
    const B = g.point('B', mul(sph(az + Math.PI), 1.1));
    const D = g.point('D', mul(sph(az), 1.1));
    const A = g.point('A', add(B, mul(Z3, a)));
    const C = g.point('C', add(D, mul(Z3, c)));
    // DE in the plane of reference, at right angles to BD, equal to AB
    const E = g.point('E', add(D, mul(unit(cross(Z3, sub(D, B))), -a)));
    g.segment(A, B, { colour: 'red' });
    g.segment(C, D, { colour: 'red' });
    g.segment(B, D);
    g.segment(D, E);
    g.segment(B, E, { aux: true });
    g.segment(A, E, { aux: true });
    g.segment(A, D, { aux: true });
    g.angle(B, D, E, { right: true });
    g.angle(E, D, A, { right: true, from: 8 });
    g.equal('AD = BE', dist(A, D), dist(B, E));
    g.equal('∠EDA = 90°', deg(angle(E, D, A)), 90);
    g.claim('B, D, A, C in one plane', coplanar([B, D, A, C]));
    g.claim('AB ∥ CD', isParallel(sub(A, B), sub(C, D)));
  },
});
