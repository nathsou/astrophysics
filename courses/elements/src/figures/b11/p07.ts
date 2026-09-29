import { figure } from '../../geometry/figure';
import { lerp } from '../../geometry/vec';
import { add, coplanar, cross, distPlane, mul, plane, v3 } from './lib';

// The line joining points on two parallels lies in their plane. The supposed line EGF, rising out
// of the plane, is drawn dashed.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.4 },
  build(g) {
    const s = g.param('s', 0.3, { min: 0.05, max: 0.95, label: 'E on AB' });
    const t = g.param('t', 0.65, { min: 0.05, max: 0.95, label: 'F on CD' });
    const tilt = g.param('tilt', 0.3, { min: 0, max: 0.8, label: 'tilt of the plane' });
    const u = v3(1, 0, 0);
    const w = v3(0, Math.cos(tilt), Math.sin(tilt));
    const n = cross(u, w);
    plane(g, v3(0, 0, 0), mul(u, 2.1), mul(w, 1.4));
    const at = (x: number, y: number) => add(mul(u, x), mul(w, y));
    const A = g.point('A', at(-1.7, -0.8));
    const B = g.point('B', at(1.7, -0.8));
    const C = g.point('C', at(-1.7, 0.8));
    const D = g.point('D', at(1.7, 0.8));
    const E = g.point('E', lerp(A, B, s));
    const F = g.point('F', lerp(C, D, t));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(E, F, { colour: 'red' });
    const arc = Array.from({ length: 33 }, (_, i) => add(lerp(E, F, i / 32), mul(n, 3.2 * (i / 32) * (1 - i / 32))));
    g.curve(arc, { dashed: true });
    const G = g.point('G', arc[16]);
    g.claim('E, F lie in the plane of AB, CD', coplanar([A, B, C, D, E, F]));
    g.claim('G is above the plane', distPlane(G, A, n) > 0.1);
  },
});
