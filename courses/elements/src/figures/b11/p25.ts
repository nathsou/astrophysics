import { figure } from '../../geometry/figure';
import type { Style } from '../../geometry/figure';
import { add, area3, boxVolume, drawBox, mul, sph, v3, type V } from './lib';

// A parallelepiped cut by a plane parallel to two opposite faces: the two parts are as their bases.
// The solid ABCD is cut by the plane FG (through E, F, U, G). AE is laid off twice more to the left
// (K, L) and EH twice more to the right (M, N), and the solids are completed on the new bases.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.35 },
  build(g) {
    const e = g.param('e', 0.4, { min: 0.2, max: 0.8, label: 'AE : AH' });
    const gam = g.param('gam', 1.25, { min: 0.9, max: 1.9, label: 'angle of the base' });
    const lean = g.param('lean', 0.25, { min: -0.4, max: 0.6, label: 'lean' });
    const len = 2.2;
    const ae = e * len;
    const eh = len - ae;
    const x = v3(1, 0, 0);
    const w = mul(sph(gam), 1.2);
    const c = v3(lean, 0.2 * lean, 1.5);
    const X0 = (t: number) => mul(x, t - len / 2);
    // bottom front line: L K A E H M N
    const fx = { L: -2 * ae, K: -ae, A: 0, E: ae, H: len, M: len + eh, N: len + 2 * eh };
    const P = (name: string, p: V) => g.point(name, p);
    const bf = Object.fromEntries(Object.entries(fx).map(([k, t]) => [k, X0(t)])) as Record<keyof typeof fx, V>;
    const L = P('L', bf.L);
    const K = P('K', bf.K);
    const A = P('A', bf.A);
    const E = P('E', bf.E);
    const H = P('H', bf.H);
    const M = P('M', bf.M);
    const N = P('N', bf.N);
    // back bottom (+w), front top (+c), back top (+w+c); '' = unnamed
    const back = (p: V) => add(p, w);
    const up = (p: V) => add(p, c);
    const L1 = back(L);
    const Pp = P('P', back(K));
    const V1 = P('V', back(A));
    const F = P('F', back(E));
    const C = P('C', back(H));
    const W = P('W', back(M));
    const S = P('S', back(N));
    const O = P('O', up(L));
    const K2 = up(K);
    const B = P('B', up(A));
    const Gp = P('G', up(E));
    const H2 = up(H);
    const I = P('I', up(M));
    const N2 = up(N);
    const X = P('X', up(L1));
    const Q = P('Q', up(Pp));
    const R = P('R', up(V1));
    const U = P('U', up(F));
    const D = P('D', up(C));
    const Y = P('Y', up(W));
    const T = P('T', up(S));
    const aux: Style = { aux: true };
    // the six solids (the original two drawn heavy)
    drawBox(g, [L, K, Pp, L1, O, K2, Q, X], aux);
    drawBox(g, [K, A, V1, Pp, K2, B, R, Q], aux);
    drawBox(g, [A, E, F, V1, B, Gp, U, R]);
    drawBox(g, [E, H, C, F, Gp, H2, D, U]);
    drawBox(g, [H, M, W, C, H2, I, Y, D], aux);
    drawBox(g, [M, N, S, W, I, N2, T, Y], aux);
    const face = (ps: V[], name: string | string[], s: Style = {}) => g.polygon(ps, { name, ...s });
    // bases
    face([A, E, F, V1], 'AF', { fill: true });
    face([E, H, C, F], ['EC', 'FH', 'HF'], { fill: true });
    face([L, K, Pp, L1], 'LP', { fill: true, aux: true });
    face([K, A, V1, Pp], 'KV', { fill: true, aux: true });
    face([H, M, W, C], 'HW', { fill: true, aux: true });
    face([M, N, S, W], 'MS', { fill: true, aux: true });
    face([L, E, F, L1], 'LF', aux);
    face([E, N, S, F], ['NF', 'FN'], aux);
    // the cutting plane and the end faces of ABCD
    face([E, F, U, Gp], 'FG', { fill: true, colour: 'red' });
    face([A, V1, R, B], 'RA', aux);
    face([H, C, D, H2], 'DH', aux);
    // front faces and side faces named in the proof
    face([L, K, K2, O], 'KO', aux);
    face([K, A, B, K2], 'KB', aux);
    face([A, E, Gp, B], 'AG', aux);
    face([L, L1, X, O], 'LX', aux);
    face([K, Pp, Q, K2], 'KQ', aux);
    face([A, V1, R, B], 'AR', aux);
    face([E, H, H2, Gp], 'HG', aux);
    face([H, M, I, H2], 'HI', aux);
    face([M, N, N2, I], 'IN', aux);
    face([M, W, Y, I], 'MY', aux);
    face([N, S, T, N2], 'NT', aux);
    const vAU = boxVolume([A, E, F, V1, B, Gp, U, R]);
    const vUH = boxVolume([E, H, C, F, Gp, H2, D, U]);
    const vLU = boxVolume([L, E, F, L1, O, Gp, U, X]);
    const vNU = boxVolume([E, N, S, F, Gp, N2, T, U]);
    g.equal('solid AU : solid UH = base AF : base FH', vAU / vUH, area3([A, E, F, V1]) / area3([E, H, C, F]));
    g.equal('solid LU = 3 × solid AU', vLU, 3 * vAU);
    g.equal('solid NU = 3 × solid HU', vNU, 3 * vUH);
  },
});
