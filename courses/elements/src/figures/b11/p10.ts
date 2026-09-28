import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, ground, isParallel, mul, sph, sub, v3 } from './lib';

// Angles with parallel arms in different planes are equal.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.35 },
  build(g) {
    const th = g.param('th', 1.0, { min: 0.4, max: 2.2, label: 'angle ABC' });
    const az = g.param('az', 1.9, { min: 1.2, max: 2.6, label: 'direction of BE' });
    const el = g.param('el', 0.9, { min: 0.5, max: 1.3, label: 'slope of BE' });
    const r = 1.4;
    ground(g, -1.7, 1.9, -1.3, 1.3);
    const B = g.point('B', v3(-0.2, -0.5, 0));
    const A = g.point('A', add(B, mul(sph(0.2), r)));
    const C = g.point('C', add(B, mul(sph(0.2 + th), r)));
    const t = mul(sph(az, el), 1.7);
    const E = g.point('E', add(B, t));
    const D = g.point('D', add(A, t));
    const F = g.point('F', add(C, t));
    g.polygon([D, E, F], { fill: true, aux: true });
    g.path(A, B, C);
    g.path(D, E, F);
    g.segment(A, D, { aux: true });
    g.segment(B, E, { aux: true });
    g.segment(C, F, { aux: true });
    g.segment(A, C, { aux: true });
    g.segment(D, F, { aux: true });
    g.angle(A, B, C);
    g.angle(D, E, F);
    g.claim('AB ∥ DE, BC ∥ EF', isParallel(sub(A, B), sub(D, E)) && isParallel(sub(C, B), sub(F, E)));
    g.equal('AC = DF', dist(A, C), dist(D, F));
    g.equal('∠ABC = ∠DEF', deg(angle(A, B, C)), deg(angle(D, E, F)));
  },
});
