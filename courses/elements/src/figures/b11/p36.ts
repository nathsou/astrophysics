import { figure } from '../../geometry/figure';
import { area3, box, boxVolume, drawBox, mul, named, sph, v3, add, distPlane, normal } from './lib';

// If A : B = B : C, the parallelepiped on A, B, C equals the equilateral one on B with the same
// solid angle. The lines A, B, C are drawn as rods at the back.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.35 },
  build(g) {
    const a = g.param('a', 2.1, { min: 1.5, max: 2.6, label: 'A' });
    const b = g.param('b', 1.3, { min: 1, max: 1.5, label: 'B' });
    const gam = g.param('gam', 1.2, { min: 0.9, max: 1.7, label: 'angle DEF' });
    const c = (b * b) / a;
    // the rods
    const rod = (x: number, l: number, name: string) => g.segment(v3(x, -0.6, 0), v3(x, -0.6, l), { name, colour: 'black', text: name });
    rod(-5.2, a, 'A');
    rod(-4.7, b, 'B');
    rod(-4.2, c, 'C');
    // the solid angle: directions d (ED), f (EF) in the plane, e (EG) elevated
    const d = sph(0);
    const f = sph(gam);
    const e = sph(0.6 * gam, 1.05);
    // EK: equilateral, all edges B
    const bE = box(v3(-3.6, -0.6, 0), mul(d, b), mul(f, b), mul(e, b));
    const [E, D, , F] = named(g, ['E', 'D', '', 'F', 'G', '', 'K'], bE);
    // LH: LM = A (along ED), LN = C (along EF), LO = B (along EG)
    const bL = box(v3(0, -0.8, 0), mul(d, a), mul(f, c), mul(e, b));
    const [L, M, , N] = named(g, ['L', 'M', '', 'N', 'O', '', 'H'], bL);
    drawBox(g, bE);
    drawBox(g, bL);
    g.polygon([E, D, add(D, mul(f, b)), F], { fill: true, name: 'DF' });
    g.polygon([L, M, add(M, mul(f, c)), N], { fill: true, name: 'MN' });
    g.equal('▱MN = ▱DF', area3([L, M, add(M, mul(f, c)), N]), area3([E, D, add(D, mul(f, b)), F]));
    g.equal('height of G = height of O', distPlane(bE[4], E, normal(E, D, F)), distPlane(bL[4], L, normal(L, M, N)));
    g.equal('solid LH = solid EK', boxVolume(bL), boxVolume(bE));
  },
});
