import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { add, area3, boxVolume, drawBox, mul, sph, v3, X3, Z3, type V } from './lib';

// In equal parallelepipeds the bases are reciprocally proportional to the heights, and conversely.
// The figure shows the first case, with the edges upright. CT is cut off equal to AG and the solid
// CV completed on NQ with height CT.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.35 },
  unresolved: {
    S: 'second case: a foot of a perpendicular from the oblique solid AB, not drawn',
    U: 'second case (oblique solids), not drawn',
    W: 'second case (oblique solids), not drawn',
    X: 'second case (oblique solids), not drawn',
    Y: 'second case (oblique solids), not drawn',
    FV: 'second case: an upright solid on the top FK, not drawn',
    DX: 'second case: an upright solid on the top RO, not drawn',
  },
  build(g) {
    const ag = g.param('ag', 1.1, { min: 0.8, max: 1.4, label: 'height AG' });
    const e1 = g.param('e1', 2, { min: 1.7, max: 2.4, label: 'side of EH' });
    const n1 = g.param('n1', 1.1, { min: 0.8, max: 1.4, label: 'side of NQ' });
    const P = (n: string, p: V) => g.point(n, p);
    // the solid AB: base A E L H, upright edges AG, EF, LB, HK
    const A = P('A', v3(-3.3, -0.6, 0));
    const p = mul(X3, e1);
    const q = mul(sph(1.3), 1.3);
    const E = P('E', add(A, p));
    const L = P('L', add(add(A, p), q));
    const H = P('H', add(A, q));
    const up1 = mul(Z3, ag);
    const [Gp, F, B, K] = [A, E, L, H].map((x, i) => P('GFBK'[i], add(x, up1)));
    // the solid CD of the same volume: base C N P Q, upright edges CM, NO, PD, QR
    const C = P('C', v3(0.4, -0.7, 0));
    const r = mul(X3, n1);
    const s = mul(sph(1.5), 1.2);
    const N = P('N', add(C, r));
    const Pp = P('P', add(add(C, r), s));
    const Q = P('Q', add(C, s));
    const vol = area3([A, E, L, H]) * ag;
    const cm = vol / area3([C, N, Pp, Q]);
    const up2 = mul(Z3, cm);
    const [M, O, D, R] = [C, N, Pp, Q].map((x, i) => P('MODR'[i], add(x, up2)));
    const T = P('T', add(C, up1));
    const V1 = P('V', add(Pp, up1));
    const sAB = [A, E, L, H, Gp, F, B, K];
    const sCD = [C, N, Pp, Q, M, O, D, R];
    const sCV = [C, N, Pp, Q, T, add(N, up1), V1, add(Q, up1)];
    drawBox(g, sAB);
    drawBox(g, sCD);
    drawBox(g, sCV, { aux: true, dashed: true });
    g.polygon([A, E, L, H], { fill: true, name: 'EH' });
    g.polygon([C, N, Pp, Q], { fill: true, name: 'NQ' });
    g.polygon([C, Q, R, M], { fill: true, aux: true, name: 'MQ' });
    g.polygon([C, Q, add(Q, up1), T], { fill: true, aux: true, name: ['TQ', 'QT'] });
    const vCD = boxVolume(sCD);
    g.equal('solid AB = solid CD', boxVolume(sAB), vCD);
    g.equal('base EH : base NQ = CM : AG', area3([A, E, L, H]) / area3([C, N, Pp, Q]), dist(C, M) / dist(A, Gp));
    g.equal('AB : CV = EH : NQ', boxVolume(sAB) / boxVolume(sCV), area3([A, E, L, H]) / area3([C, N, Pp, Q]));
    g.claim('EH > NQ, so CM > AG', dist(C, M) > dist(A, Gp));
  },
});
