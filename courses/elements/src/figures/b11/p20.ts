import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, meet, mul, rotAxis, sph, v3, X3, type V } from './lib';

// In a trihedral angle, any two face angles together exceed the third.
// The largest angle is BAC; AE in its plane makes ∠BAE = ∠DAB, with AE = AD, and the line BEC
// is drawn across the angle through E.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.25 },
  build(g) {
    const al = g.param('al', 1.9, { min: 1.6, max: 2.2, label: 'angle BAC' });
    const psi = g.param('psi', 0.45, { min: 0.3, max: 0.7, label: 'direction of AD' });
    const el = g.param('el', 0.75, { min: 0.5, max: 1.05, label: 'elevation of AD' });
    // built with the plane BAC horizontal, then turned so that the vertex A is at the top
    const turn = (p: V) => rotAxis(p, X3, -Math.PI / 2 + 0.4);
    const rot = Math.PI / 2;
    const uB = sph(rot + al / 2);
    const uC = sph(rot - al / 2);
    const uD = sph(rot + al / 2 - psi * al, -el);
    const d = 1.3;
    const A0 = v3(0, 0, 0);
    const D0 = mul(uD, d);
    const beta = angle(D0, A0, uB);
    const E0 = mul(sph(rot + al / 2 - beta), d);
    const across = add(E0, sph(rot + Math.PI / 2));
    const B0 = meet(A0, uB, E0, across);
    const C0 = meet(A0, uC, E0, across);
    const A = g.point('A', turn(A0));
    const B = g.point('B', turn(B0));
    const C = g.point('C', turn(C0));
    const D = g.point('D', turn(D0));
    const E = g.point('E', turn(E0));
    g.polygon([A, B, C], { fill: true });
    g.polygon([A, B, D], { fill: true, aux: true });
    g.polygon([A, C, D], { fill: true, aux: true });
    g.segment(A, B);
    g.segment(A, C);
    g.segment(A, D);
    g.segment(B, C);
    g.segment(A, E, { aux: true });
    g.segment(D, B, { aux: true });
    g.segment(D, C, { aux: true });
    const [bac, cad, dab] = [angle(B, A, C), angle(C, A, D), angle(D, A, B)].map(deg);
    g.equal('DB = BE', dist(D, B), dist(B, E));
    g.claim('DC > EC', dist(D, C) > dist(E, C));
    g.claim('∠DAB + ∠DAC > ∠BAC', dab + cad > bac);
    g.claim('∠BAC + ∠CAD > ∠DAB and ∠BAC + ∠DAB > ∠CAD', bac + cad > dab && bac + dab > cad);
    g.show('∠BAC, ∠CAD, ∠DAB', `${bac.toFixed(1)}°, ${cad.toFixed(1)}°, ${dab.toFixed(1)}°`);
  },
});
