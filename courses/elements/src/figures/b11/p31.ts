import { figure } from '../../geometry/figure';
import { add, area3, boxVolume, drawBox, meet, mul, sph, sub, v3, X3, type V } from './lib';

// Parallelepipeds on equal bases and of the same height are equal. The figure shows the first case
// (upright solids). The base AB (= A L B H) is copied to RUWT on RT, the continuation of CR; the
// solid XU on it equals AE. XU is sheared (XI.29) into YX, whose base YT has the side RT in common
// with DT; then XI.25 compares both CF and YX with RI.
export default figure({
  dim: 3,
  camera: { yaw: -0.2, pitch: -0.5 },
  unresolved: {
    N: 'second case: the letters are reused for the oblique solids, which the figure does not draw',
    CN: 'second case (oblique solids), not drawn',
    NY: 'second case (oblique solids), not drawn',
  },
  build(g) {
    const phi = g.param('phi', 1.15, { min: 0.8, max: 1.5, label: 'angle ALB' });
    const psi = g.param('psi', 1.35, { min: 1, max: 1.9, label: 'angle of the base CD' });
    const cr = g.param('cr', 1.1, { min: 0.8, max: 1.4, label: 'CR' });
    const h = 1.2;
    const up = v3(0, 0, h);
    const la = 1.3;
    const lb = 1.15;
    const P = (n: string, p: V) => g.point(n, p);
    // the solid AE on the base A L B H
    const L = P('L', v3(-3.4, -0.9, 0));
    const A = P('A', add(L, mul(sph(1.95), la)));
    const B = P('B', add(L, mul(sph(1.95 - phi), lb)));
    const H = P('H', add(A, sub(B, L)));
    const [Gp, M, E, K] = [A, L, B, H].map((p, i) => P('GMEK'[i], add(p, up)));
    // the solid CF on the base C R D P, of equal area
    const R = P('R', v3(0.2, -0.3, 0));
    const C = P('C', sub(R, mul(X3, cr)));
    const area = la * lb * Math.sin(phi);
    const dlt = mul(sph(psi), area / (cr * Math.sin(psi)));
    const D = P('D', add(R, dlt));
    const Pp = P('P', add(C, dlt));
    const [O, S, F, Q] = [C, R, D, Pp].map((p, i) => P('OSFQ'[i], add(p, up)));
    // RT in line with CR, ∠TRU = ∠ALB, RT = AL, RU = LB, on the other side of CR from D
    const T = P('T', add(R, mul(X3, la)));
    const U = P('U', add(R, mul(sph(-phi), lb)));
    const W = P('W', add(T, sub(U, R)));
    const X = P('X', add(T, up));
    const V1 = P('V', add(W, up));
    const Y = P('Y', meet(D, R, W, U));
    const a = P('a', meet(Pp, D, T, add(T, dlt)));
    const b = P('b', meet(T, add(T, dlt), Y, W));
    const I = P('I', add(a, up));
    const Uu = add(U, up);
    const Yu = add(Y, up);
    const bu = add(b, up);
    const sAE = [A, L, B, H, Gp, M, E, K];
    const sCF = [C, R, D, Pp, O, S, F, Q];
    const sXU = [R, U, W, T, S, Uu, V1, X];
    const sYX = [Y, R, T, b, Yu, S, X, bu];
    const sRI = [R, T, a, D, S, X, I, F];
    drawBox(g, sAE);
    drawBox(g, sCF);
    drawBox(g, sXU, { aux: true });
    drawBox(g, sYX, { aux: true, dashed: true });
    drawBox(g, sRI, { aux: true });
    g.polygon([A, L, B, H], { fill: true, name: 'AB' });
    g.polygon([C, R, D, Pp], { fill: true, name: 'CD' });
    g.polygon([R, U, W, T], { fill: true, name: 'RW' });
    g.polygon([Y, R, T, b], { fill: true, name: 'YT' });
    g.polygon([R, T, a, D], { name: 'DT', aux: true });
    g.polygon([A, L, M, Gp], { name: 'AM', aux: true });
    g.polygon([L, B, E, M], { name: 'LE', aux: true });
    g.polygon([R, T, X, S], { fill: true, name: 'RX', aux: true });
    g.polygon([R, U, Uu, S], { name: 'SU', aux: true });
    g.polygon([U, W, V1, Uu], { name: 'UV', aux: true });
    g.polygon([R, D, F, S], { fill: true, name: 'RF', aux: true });
    g.segment(Y, W, { aux: true, dashed: true });
    g.segment(Y, R, { aux: true, dashed: true });
    const vAE = boxVolume(sAE);
    g.equal('solid XU = solid AE', boxVolume(sXU), vAE);
    g.equal('solid YX = solid XU (XI.29)', boxVolume(sYX), boxVolume(sXU));
    g.equal('base YT = base CD', area3([Y, R, T, b]), area3([C, R, D, Pp]));
    g.equal('solid CF : RI = solid YX : RI', boxVolume(sCF) / boxVolume(sRI), boxVolume(sYX) / boxVolume(sRI));
    g.equal('solid AE = solid CF', vAE, boxVolume(sCF));
  },
});
