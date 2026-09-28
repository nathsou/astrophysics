import { figure } from '../../geometry/figure';
import { angle, deg } from '../../geometry/vec';
import { add, coplanar, ground, mul, sph, v3, Z3 } from './lib';

// A line perpendicular to three lines at their common point: the three lines are in one plane.
// The reductio: BD, BE lie in the plane of reference and BC is supposed to rise above it. The plane
// through AB and BC meets the plane of reference in BF, and then ∠ABF and ∠ABC would both be right.
export default figure({
  dim: 3,
  camera: { yaw: -0.55, pitch: -0.35 },
  build(g) {
    const phi = g.param('phi', 0.9, { min: 0.4, max: 1.4, label: 'direction of BF' });
    const e = g.param('e', 0.45, { min: 0.15, max: 0.9, label: 'supposed rise of BC' });
    ground(g, -1.9, 1.9, -1.6, 1.6);
    const B = g.point('B', v3(0, 0, 0));
    const A = g.point('A', v3(0, 0, 1.9));
    const D = g.point('D', mul(sph(3.6), 1.6));
    const E = g.point('E', mul(sph(4.9), 1.5));
    const f = sph(phi);
    const F = g.point('F', mul(f, 1.6));
    const C = g.point('C', add(mul(f, 1.6 * Math.cos(e)), mul(Z3, 1.6 * Math.sin(e))));
    // the plane through AB, BC
    g.polygon([mul(f, -0.4), mul(f, 1.9), add(mul(f, 1.9), mul(Z3, 2.1)), add(mul(f, -0.4), mul(Z3, 2.1))], { fill: true, aux: true });
    g.segment(A, B, { colour: 'red' });
    g.segment(B, D);
    g.segment(B, E);
    g.segment(B, F);
    g.segment(B, C, { dashed: true });
    g.angle(A, B, F, { right: true });
    g.equal('∠ABD = 90°', deg(angle(A, B, D)), 90);
    g.equal('∠ABE = 90°', deg(angle(A, B, E)), 90);
    g.equal('∠ABF = 90°', deg(angle(A, B, F)), 90);
    g.claim('A, B, C, F in one plane', coplanar([A, B, C, F]));
    g.claim('∠ABC < ∠ABF, so the elevated BC is not at right angles to AB', deg(angle(A, B, C)) < 89.9);
  },
});
