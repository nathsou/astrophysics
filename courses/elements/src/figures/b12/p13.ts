import { figure } from '../../geometry/figure';
import { dist, type V } from '../../geometry/vec';
import { v3 } from './lib';

// The cylinder AD (axis EF) cut by the plane GH at K. The axis is produced both ways: EN = NL = EK
// and FO = OM = FK, and the cylinder PW on the axis LM is imagined, cut by the planes through N and
// O. Each cylinder is named, as in Heath's figure, by a diagonal of its section through the axis.
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: 0.3 },
  build(g) {
    const t = g.param('t', 0.62, { min: 0.3, max: 0.8, label: 'position of the plane GH' });
    const r = 1.1;
    const len = 2.4;
    const a = len * (1 - t); // EK
    const b = len * t; // KF
    const lev = { L: 3 * a + b, N: 2 * a + b, E: a + b, K: b, F: 0, O: -b, M: -2 * b };
    const Z = (z: number) => z - (a + b) / 2;
    const pair = (l: string, rr: string, z: number, s: { hidden?: boolean } = {}): [V, V] => [g.point(l, v3(-r, 0, Z(z)), s), g.point(rr, v3(r, 0, Z(z)), s)];
    const [P, Q] = pair('P', 'Q', lev.L);
    const [R, S] = pair('R', 'S', lev.N);
    const [A, B] = pair('A', 'B', lev.E);
    const [G, H] = pair('G', 'H', lev.K);
    const [C, D] = pair('C', 'D', lev.F);
    const [T, U] = pair('T', 'U', lev.O);
    const [Vv, W] = pair('V', 'W', lev.M);
    const ax = (n: string, z: number) => g.point(n, v3(0, 0, Z(z)));
    const L = ax('L', lev.L);
    const N = ax('N', lev.N);
    const E = ax('E', lev.E);
    const K = ax('K', lev.K);
    const F = ax('F', lev.F);
    const O = ax('O', lev.O);
    const M = ax('M', lev.M);
    const up = v3(0, 0, 1);
    for (const c of [E, K, F]) g.circle3(c, up, r);
    for (const c of [L, N, O, M]) g.circle3(c, up, r, { aux: true });
    g.segment(E, F);
    g.segment(L, E, { aux: true, dashed: true });
    g.segment(F, M, { aux: true, dashed: true });
    // sections through the axis: the slabs between neighbouring planes …
    g.polygon([A, B, H, G], { fill: true });
    g.polygon([G, H, D, C], { fill: true });
    g.polygon([P, Q, S, R], { aux: true });
    g.polygon([R, S, B, A], { aux: true });
    g.polygon([C, D, U, T], { aux: true });
    g.polygon([T, U, W, Vv], { aux: true });
    // … and the unions the text names (AD, QG, GW, PW)
    g.polygon([A, B, D, C], { aux: true });
    g.polygon([P, Q, H, G], { aux: true });
    g.polygon([G, H, W, Vv], { aux: true });
    g.polygon([P, Q, W, Vv], { aux: true });
    const cyl = (h: number) => Math.PI * r * r * h;
    const EK = dist(E, K);
    const KF = dist(K, F);
    g.equal('KL = 3 EK', dist(K, L), 3 * EK);
    g.equal('cylinder QG = 3 × cylinder BG', cyl(dist(K, L)), 3 * cyl(EK));
    g.equal('cylinder GW = 3 × cylinder GD', cyl(dist(K, M)), 3 * cyl(KF));
    g.claim('KL >, =, < KM exactly as cylinder QG >, =, < GW', Math.sign(dist(K, L) - dist(K, M)) === Math.sign(cyl(dist(K, L)) - cyl(dist(K, M))));
    g.equal('cylinder BG : cylinder GD = EK : KF', cyl(EK) / cyl(KF), EK / KF);
  },
});
