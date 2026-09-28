import { figure } from '../../geometry/figure';
import { dot, sub } from '../../geometry/vec';
import { add, distPlane, ground, mul, sph, v3, Z3 } from './lib';

// Two planes through pairs of parallel intersecting lines are parallel.
export default figure({
  dim: 3,
  camera: { yaw: -0.55, pitch: -0.5 },
  build(g) {
    const th = g.param('th', 1.2, { min: 0.6, max: 2, label: 'angle DEF' });
    const h = g.param('h', 1.6, { min: 1, max: 2.2, label: 'height of B' });
    const off = g.param('off', 0.3, { min: -0.3, max: 0.8, label: 'offset of B' });
    ground(g, -2.1, 2.1, -1.5, 1.5);
    const e = sph(-0.25);
    const f = sph(-0.25 + th);
    const E = g.point('E', v3(-0.8, -0.6, 0));
    const D = g.point('D', add(E, mul(e, 1.7)));
    const F = g.point('F', add(E, mul(f, 1.5)));
    const B = g.point('B', v3(0.5 + off, 0.55, h));
    const A = g.point('A', add(B, mul(e, 1.5)));
    const C = g.point('C', add(B, mul(f, 1.3)));
    const Gp = g.point('G', v3(B.x, B.y, 0));
    const H = g.point('H', add(Gp, mul(e, 1.1)));
    const K = g.point('K', add(Gp, mul(f, 1)));
    // the plane through AB, BC
    g.polygon([add(B, mul(add(e, f), -0.6)), add(B, mul(e, 1.9)), add(B, mul(add(e, f), 1.5)), add(B, mul(f, 1.8))], { fill: true, aux: true });
    g.path(A, B, C);
    g.path(D, E, F);
    g.segment(B, Gp, { colour: 'red' });
    g.segment(Gp, H, { aux: true });
    g.segment(Gp, K, { aux: true });
    g.angle(B, Gp, H, { right: true });
    g.angle(Gp, B, A, { right: true });
    g.equal('GB · BA = 0', dot(sub(Gp, B), sub(A, B)), 0);
    g.equal('GB · BC = 0', dot(sub(Gp, B), sub(C, B)), 0);
    g.equal('A and C are at the same height above DEF as B', distPlane(A, E, Z3) + distPlane(C, E, Z3), 2 * distPlane(B, E, Z3));
  },
});
