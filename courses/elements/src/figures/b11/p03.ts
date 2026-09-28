import { figure } from '../../geometry/figure';
import { lerp } from '../../geometry/vec';
import { add, distLine, distPlane, mul, sub, v3 } from './lib';

// If two planes cut one another, their common section is a straight line.
// The reductio: if not, the "straight lines" DEB in one plane and DFB in the other would join D to
// B and enclose an area. They are drawn dashed, bent, as they would have to be.
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: -0.42 },
  build(g) {
    const tilt = g.param('tilt', 0.9, { min: 0.3, max: 1.4, label: 'angle between the planes' });
    const s = 1.5;
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    const n1 = v3(0, 0, 1); // normal of the plane AB
    const w2 = v3(0, c, sn); // direction across the plane BC
    const n2 = v3(0, -sn, c);
    const D = g.point('D', v3(-s, 0, 0));
    const B = g.point('B', v3(s, 0, 0));
    g.polygon([v3(-s, -s, 0), v3(s, -s, 0), v3(s, s, 0), v3(-s, s, 0)], { fill: true, aux: true, name: 'AB' });
    g.polygon([sub(D, mul(w2, s)), sub(B, mul(w2, s)), add(B, mul(w2, s)), add(D, mul(w2, s))], { fill: true, aux: true, name: 'BC' });
    g.segment(D, B, { colour: 'red' });
    // the supposed straight lines DEB (in the plane AB) and DFB (in the plane BC), bowed apart
    const bow = (dir: ReturnType<typeof v3>) => Array.from({ length: 33 }, (_, i) => add(lerp(D, B, i / 32), mul(dir, 2.4 * (i / 32) * (1 - i / 32))));
    const e = bow(v3(0, -0.75, 0));
    const f = bow(mul(w2, 0.75));
    g.curve(e, { dashed: true });
    g.curve(f, { dashed: true });
    const E = g.point('E', e[16]);
    const F = g.point('F', f[16]);
    const M = lerp(D, B, 0.37);
    g.equal('D, B, and every point of DB lie in both planes', distPlane(M, D, n1) + distPlane(M, D, n2) + distPlane(B, D, n2), 0);
    g.claim('DEB and DFB are not straight (E, F off DB)', distLine(E, D, B) > 0.1 && distLine(F, D, B) > 0.1);
    g.claim('E in the plane AB, F in the plane BC', distPlane(E, D, n1) < 1e-9 && distPlane(F, D, n2) < 1e-9);
  },
});
