import { figure } from '../../geometry/figure';
import { angle, deg, dot, lerp } from '../../geometry/vec';
import { add, cross, ground, isParallel, mul, sph, sub, unit, v3, X3, Y3, Z3 } from './lib';

// Every plane through a perpendicular to a plane is perpendicular to that plane.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.35 },
  build(g) {
    const phi = g.param('phi', 0.25, { min: -0.5, max: 0.9, label: 'turn the plane DE about AB' });
    const s = g.param('s', 0.78, { min: 0.6, max: 0.95, label: 'F on CE' });
    ground(g, -2, 2, -1.5, 1.5);
    const d = sph(phi);
    const B = g.point('B', v3(-0.2, 0, 0));
    const A = g.point('A', add(B, mul(Z3, 1.7)));
    const C = g.point('C', add(B, mul(d, -1.5)));
    const E = g.point('E', add(B, mul(d, 1.7)));
    const top = 2.1;
    const D = g.point('D', add(C, mul(Z3, top)));
    g.polygon([C, E, add(E, mul(Z3, top)), D], { fill: true, aux: true, name: 'DE' });
    const F = g.point('F', lerp(C, E, s));
    // FG drawn in the plane DE at right angles to CE
    const nDE = cross(sub(E, C), sub(D, C));
    const Gp = g.point('G', add(F, mul(unit(cross(nDE, sub(E, C))), 1.3)));
    g.segment(C, E);
    g.segment(A, B, { colour: 'red' });
    g.segment(F, Gp, { colour: 'blue' });
    g.angle(A, B, F, { right: true });
    g.angle(Gp, F, B, { right: true });
    g.claim('FG ∥ AB', isParallel(sub(Gp, F), sub(A, B)));
    g.equal('FG ⊥ plane of reference (FG · x = FG · y = 0)', Math.abs(dot(sub(Gp, F), X3)) + Math.abs(dot(sub(Gp, F), Y3)), 0);
    g.equal('∠GFB = 90°', deg(angle(Gp, F, B)), 90);
  },
});
