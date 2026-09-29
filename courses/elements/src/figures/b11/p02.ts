import { figure } from '../../geometry/figure';
import { lerp } from '../../geometry/vec';
import { add, coplanar, mul, plane, v3 } from './lib';

// Two straight lines that cut one another lie in one plane, and so does every triangle.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.45 },
  build(g) {
    const th = g.param('th', 1.9, { min: 1.2, max: 2.6, label: 'angle between AB and CD' });
    const tilt = g.param('tilt', 0.35, { min: 0, max: 0.9, label: 'tilt of the plane' });
    const u = v3(1, 0, 0);
    const w = v3(0, Math.cos(tilt), Math.sin(tilt));
    const at = (r: number, a: number) => add(mul(u, r * Math.cos(a)), mul(w, r * Math.sin(a)));
    plane(g, v3(0, 0, 0), mul(u, 2.1), mul(w, 1.9));
    const a0 = -0.15;
    const E = g.point('E', v3(0, 0, 0));
    const A = g.point('A', at(1.6, a0 + Math.PI));
    const B = g.point('B', at(1.7, a0));
    const C = g.point('C', at(1.6, a0 + th));
    const D = g.point('D', at(1.4, a0 + th + Math.PI));
    const F = g.point('F', lerp(E, C, 0.55));
    const Gp = g.point('G', lerp(E, B, 0.6));
    const H = g.point('H', lerp(C, B, 0.28));
    const K = g.point('K', lerp(C, B, 0.72));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(C, B);
    g.segment(F, Gp, { aux: true });
    g.segment(F, H, { aux: true });
    g.segment(Gp, K, { aux: true });
    g.polygon([E, C, B], { fill: true });
    g.claim('A, B, C, D, E, F, G, H, K lie in one plane', coplanar([E, A, B, C, D, F, Gp, H, K]));
  },
});
