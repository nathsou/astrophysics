import { figure } from '../../geometry/figure';
import { add, cross, distPlane, mul, plane, sph, sub, unit, Z3 } from './lib';

// Planes perpendicular to the same line are parallel. In the reductio the planes would meet in a
// line GH, and a triangle ABK would have two right angles; the dashed lines from A and B, both
// perpendicular to AB, never meet.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.4 },
  unresolved: {
    GH: 'the supposed common section of the planes, which cannot exist',
    K: 'a point of the supposed common section GH, which cannot exist',
    AK: 'joins A to the impossible point K',
    BK: 'joins B to the impossible point K',
    ABK: 'the impossible triangle with two right angles',
    BAK: 'an angle of the impossible triangle ABK',
  },
  build(g) {
    const tilt = g.param('tilt', 0.3, { min: 0, max: 0.7, label: 'tilt of AB' });
    const len = g.param('len', 1.8, { min: 1.2, max: 2.4, label: 'AB' });
    const d = unit(add(Z3, mul(sph(-2.2), Math.tan(tilt))));
    const u = unit(cross(sph(1.6), d));
    const w = cross(d, u);
    const B = g.point('B', mul(d, -len / 2));
    const A = g.point('A', mul(d, len / 2));
    plane(g, A, mul(u, 1.6), mul(w, 1.3), { name: 'CD' });
    plane(g, B, mul(u, 1.6), mul(w, 1.3), { name: 'EF' });
    g.segment(A, B, { colour: 'red' });
    g.segment(A, add(A, mul(u, 1.5)), { dashed: true, aux: true });
    g.segment(B, add(B, mul(u, 1.5)), { dashed: true, aux: true });
    const corners = [add(B, mul(u, 1.6)), add(B, mul(w, 1.3)), sub(B, mul(u, 1.6))];
    g.equal('every point of EF is at distance AB from CD', Math.max(...corners.map((p) => distPlane(p, A, d))), len);
  },
});
