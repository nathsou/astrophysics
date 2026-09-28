import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, cross, dot, ground, mul, sph, sub, unit, Z3 } from './lib';

// If one of two parallels is perpendicular to a plane, so is the other.
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: -0.35 },
  build(g) {
    const az = g.param('az', 0.2, { min: -0.5, max: 0.8, label: 'direction of BD' });
    const a = g.param('a', 1.5, { min: 0.8, max: 2.2, label: 'AB' });
    const k = g.param('k', 1.3, { min: 0.6, max: 1.6, label: 'CD : AB' });
    ground(g, -2, 2, -1.7, 1.5);
    const B = g.point('B', mul(sph(az + Math.PI), 1.1));
    const D = g.point('D', mul(sph(az), 1.1));
    const A = g.point('A', add(B, mul(Z3, a)));
    // CD is drawn parallel to AB
    const C = g.point('C', add(D, mul(sub(A, B), k)));
    const E = g.point('E', add(D, mul(unit(cross(Z3, sub(D, B))), -a)));
    g.segment(A, B, { colour: 'red' });
    g.segment(C, D, { colour: 'blue' });
    g.segment(B, D);
    g.segment(D, E);
    g.segment(B, E, { aux: true });
    g.segment(A, E, { aux: true });
    g.segment(A, D, { aux: true });
    g.angle(B, D, E, { right: true });
    g.equal('AD = BE', dist(A, D), dist(B, E));
    g.equal('∠EDA = 90°', deg(angle(E, D, A)), 90);
    g.equal('CD · DB = 0', dot(sub(C, D), sub(B, D)), 0);
    g.equal('CD · DE = 0 (so CD ⊥ plane)', dot(sub(C, D), sub(E, D)), 0);
  },
});
