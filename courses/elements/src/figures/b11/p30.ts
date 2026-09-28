import { figure } from '../../geometry/figure';
import { box, boxVolume, drawBox, meet, mul, named, sph, v3 } from './lib';

// The general 3D shear: parallelepipeds on the same base ACBL and of the same height are equal,
// wherever their tops FDHM and GEKN lie in the top plane. The intermediate solid CP, with top
// OQRP, shares a pair of lines with each (XI.29 twice).
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.45 },
  build(g) {
    const x1 = g.param('x1', -0.5, { min: -1.1, max: 0.2, label: 'shift of FDHM' });
    const x2 = g.param('x2', 0.7, { min: 0.3, max: 1.5, label: 'shift of GEKN (sideways)' });
    const y2 = g.param('y2', 1.2, { min: 0.6, max: 1.6, label: 'shift of GEKN (back)' });
    const h = 1.5;
    const p = mul(sph(1.25), 1.3); // A → C
    const q = v3(1.8, 0, 0); // A → L
    const o = v3(-1.8, -0.8, 0);
    const b1 = box(o, p, q, v3(x1, -0.6, h));
    const b2 = box(o, p, q, v3(x2, y2, h));
    const [A, C, B, L, F, D, H, M] = named(g, ['A', 'C', 'B', 'L', 'F', 'D', 'H', 'M'], b1);
    const [Gp, E, K, N] = named(g, ['G', 'E', 'K', 'N'], b2.slice(4));
    // the lines of the tops, produced: R = NK ∩ DH, Q = GE ∩ DH, P = FM ∩ NK, O = FM ∩ GE
    const R = g.point('R', meet(N, K, D, H));
    const Q = g.point('Q', meet(Gp, E, D, H));
    const P = g.point('P', meet(F, M, N, K));
    const O = g.point('O', meet(F, M, Gp, E));
    drawBox(g, b1);
    drawBox(g, [A, C, B, L, Gp, E, K, N]);
    drawBox(g, [A, C, B, L, O, Q, R, P], { aux: true });
    g.polygon([A, C, B, L], { fill: true });
    g.polygon([F, D, H, M], { fill: true, colour: 'red' });
    g.polygon([Gp, E, K, N], { fill: true, colour: 'blue' });
    g.polygon([O, Q, R, P], { fill: true, aux: true });
    for (const [a, b] of [[F, P], [D, R], [Gp, Q], [N, R]]) g.segment(a, b, { aux: true, dashed: true });
    const v0 = boxVolume(b1);
    g.equal('solid CM = solid CP', v0, boxVolume([A, C, B, L, O, Q, R, P]));
    g.equal('solid CP = solid CN', boxVolume([A, C, B, L, O, Q, R, P]), boxVolume(b2));
  },
});
