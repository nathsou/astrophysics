import { figure } from '../../geometry/figure';
import { dot } from '../../geometry/vec';
import { add, cross, distLine, ground, mul, sph, sub, unit, v3, X3, Y3, Z3 } from './lib';

// If two planes are both perpendicular to a plane, so is their common section. Each plane is
// built as the plane through a line of the plane of reference and perpendicular to it; their common
// section BD is computed, not assumed vertical. DE and DF, drawn in each plane at right angles to
// the sections AD and CD, both turn out to lie along DB.
export default figure({
  dim: 3,
  camera: { yaw: -0.4, pitch: -0.35 },
  build(g) {
    const a1 = g.param('a1', 3.5, { min: 3, max: 4, label: 'direction of DA' });
    const a2 = g.param('a2', 5.9, { min: 5.3, max: 6.3, label: 'direction of DC' });
    ground(g, -2, 2, -1.6, 1.4);
    const D = g.point('D', v3(0, 0, 0));
    const A = g.point('A', mul(sph(a1), 1.8));
    const C = g.point('C', mul(sph(a2), 1.8));
    // the plane AB: through AD, perpendicular to the plane of reference (normal n1); likewise BC
    const n1 = cross(sub(A, D), Z3);
    const n2 = cross(sub(C, D), Z3);
    let s = unit(cross(n1, n2));
    if (s.z! < 0) s = mul(s, -1);
    const h = 2;
    const B = g.point('B', add(D, mul(s, h)));
    g.polygon([A, D, B, add(A, mul(s, h))], { fill: true, aux: true, name: 'AB' });
    g.polygon([C, D, B, add(C, mul(s, h))], { fill: true, aux: true, name: 'BC' });
    const up = (w: ReturnType<typeof unit>) => (w.z! < 0 ? mul(w, -1) : w);
    const E = g.point('E', add(D, mul(up(unit(cross(n1, sub(A, D)))), 0.9)), { labelDir: 180 });
    const F = g.point('F', add(D, mul(up(unit(cross(n2, sub(C, D)))), 1.45)), { labelDir: 0 });
    g.segment(A, D);
    g.segment(C, D);
    g.segment(D, B, { colour: 'red' });
    g.angle(E, D, A, { right: true });
    g.angle(F, D, C, { right: true });
    g.claim('E and F lie on DB', distLine(E, D, B) < 1e-9 && distLine(F, D, B) < 1e-9);
    g.equal('BD ⊥ plane of reference (BD · x = BD · y = 0)', Math.abs(dot(sub(B, D), X3)) + Math.abs(dot(sub(B, D), Y3)), 0);
  },
});
