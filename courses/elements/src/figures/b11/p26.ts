import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, cross, footPlane, mul, sph, sub, v3, Z3 } from './lib';

// Copy a solid angle to a given point of a given line. The given solid angle at D is contained by
// EDC, EDF, FDC; FG is the perpendicular from F to the plane EDC. At A, the angles BAL = EDC and
// BAK = EDG are made in a plane, AK = DG, and KH is set up perpendicular to that plane with KH = GF.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.35 },
  build(g) {
    const edc = g.param('edc', 1.25, { min: 0.8, max: 1.7, label: 'angle EDC' });
    const psi = g.param('psi', 0.45, { min: 0.25, max: 0.75, label: 'direction of DF' });
    const el = g.param('el', 0.85, { min: 0.5, max: 1.15, label: 'elevation of DF' });
    const rho = g.param('rho', 0.6, { min: -0.2, max: 1.4, label: 'direction of AB' });
    const r = 1.4;
    const D = g.point('D', v3(-2, 0, 0));
    const e0 = -0.35;
    const E = g.point('E', add(D, mul(sph(e0), r)));
    const C = g.point('C', add(D, mul(sph(e0 + edc), r)));
    const F = g.point('F', add(D, mul(sph(e0 + psi * edc, el), 1.5)));
    const Gp = g.point('G', footPlane(F, D, Z3));
    // at A: the angle BAL = EDC and BAK = EDG, on the same side, in the plane of A (here horizontal)
    const A = g.point('A', v3(1.4, 0, 0));
    const B = g.point('B', add(A, mul(sph(rho), r)));
    const L = g.point('L', add(A, mul(sph(rho + edc), r)));
    const edg = angle(E, D, Gp) * Math.sign(cross(sub(E, D), sub(Gp, D)).z ?? 1);
    const K = g.point('K', add(A, mul(sph(rho + edg), dist(D, Gp))));
    const H = g.point('H', add(K, mul(Z3, dist(F, Gp))));
    for (const [V0, X, Y, Z] of [[D, E, C, F], [A, B, L, H]]) {
      g.polygon([V0, X, Y], { fill: true });
      g.polygon([V0, X, Z], { fill: true, aux: true });
      g.polygon([V0, Y, Z], { fill: true, aux: true });
      g.segment(V0, X);
      g.segment(V0, Y);
      g.segment(V0, Z);
    }
    g.segment(F, Gp, { colour: 'red' });
    g.segment(D, Gp, { aux: true });
    g.segment(Gp, E, { aux: true });
    g.segment(F, E, { aux: true });
    g.segment(H, K, { colour: 'red' });
    g.segment(A, K, { aux: true });
    g.segment(K, B, { aux: true });
    g.segment(H, B, { aux: true });
    g.angle(F, Gp, D, { right: true });
    g.angle(H, K, A, { right: true });
    g.equal('∠BAL = ∠EDC', deg(angle(B, A, L)), deg(angle(E, D, C)));
    g.equal('∠BAH = ∠EDF', deg(angle(B, A, H)), deg(angle(E, D, F)));
    g.equal('∠HAL = ∠FDC', deg(angle(H, A, L)), deg(angle(F, D, C)));
    g.equal('HB = FE', dist(H, B), dist(F, E));
  },
});
