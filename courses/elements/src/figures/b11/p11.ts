import { figure } from '../../geometry/figure';
import { dot, sub } from '../../geometry/vec';
import { add, cross, footLine, ground, mul, sph, unit, v3, X3, Y3, Z3 } from './lib';

// From a point above a plane, drop the perpendicular to the plane (with ruler-and-compass steps
// in planes only: two perpendiculars and a parallel).
export default figure({
  dim: 3,
  camera: { yaw: -0.4, pitch: -0.5 },
  build(g) {
    const beta = g.param('beta', 0.15, { min: -0.4, max: 0.6, label: 'direction of BC' });
    const ay = g.param('ay', 0.4, { min: -0.1, max: 0.9, label: 'position of A' });
    const h = g.param('h', 1.6, { min: 0.9, max: 2.2, label: 'height of A' });
    ground(g, -2.1, 2.1, -1.6, 1.6);
    const b = sph(beta);
    const P0 = v3(0, -0.9, 0);
    const B = g.point('B', add(P0, mul(b, -1.8)));
    const C = g.point('C', add(P0, mul(b, 1.8)));
    const A = g.point('A', v3(0.35, ay, h));
    const D = g.point('D', footLine(A, B, C));
    const E = g.point('E', add(D, mul(unit(cross(Z3, b)), 2.1)));
    const F = g.point('F', footLine(A, D, E));
    const Gp = g.point('G', add(F, mul(b, -1)));
    const H = g.point('H', add(F, mul(b, 1)));
    g.segment(B, C);
    g.segment(D, E);
    g.segment(Gp, H, { colour: 'blue' });
    g.segment(A, D, { aux: true });
    g.segment(A, F, { colour: 'red' });
    g.angle(A, D, C, { right: true });
    g.angle(A, F, E, { right: true });
    g.angle(A, F, H, { right: true });
    const af = sub(F, A);
    g.equal('AF · DE = 0', dot(af, sub(E, D)), 0);
    g.equal('AF · GH = 0', dot(af, sub(H, Gp)), 0);
    g.equal('AF ⊥ the plane (AF · x = AF · y = 0)', Math.abs(dot(af, X3)) + Math.abs(dot(af, Y3)), 0);
  },
});
