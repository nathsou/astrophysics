import { figure } from '../../geometry/figure';
import { dist, mid } from '../../geometry/vec';
import { distLine, v3 } from './lib';

// In a cube, the line joining the centres of two opposite faces and a diagonal of the cube bisect
// each other. Top face C D F E, bottom A B H G (A under C, B under D, H under F, G under E).
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: -0.35 },
  build(g) {
    const side = g.param('side', 2, { min: 1.4, max: 2.6, label: 'side of the cube' });
    const s = side / 2;
    const P = (n: string, x: number, y: number, z: number) => g.point(n, v3(x * s, y * s, z * s));
    const C = P('C', -1, -1, 1);
    const D = P('D', 1, -1, 1);
    const F = P('F', 1, 1, 1);
    const E = P('E', -1, 1, 1);
    const A = P('A', -1, -1, -1);
    const B = P('B', 1, -1, -1);
    const H = P('H', 1, 1, -1);
    const Gp = P('G', -1, 1, -1);
    const M2 = (n: string, p: typeof A, q: typeof A) => g.point(n, mid(p, q));
    const K = M2('K', C, D);
    const L = M2('L', F, E);
    const O = M2('O', D, F);
    const Pp = M2('P', C, E);
    const M = M2('M', A, B);
    const N = M2('N', H, Gp);
    const Q = M2('Q', B, H);
    const R = M2('R', A, Gp);
    const U = g.point('U', mid(D, E));
    const S = g.point('S', mid(B, Gp));
    const T = g.point('T', mid(D, Gp));
    g.polygon([C, D, F, E], { name: 'CF' });
    g.polygon([A, B, H, Gp], { name: 'AH' });
    for (const [p, q] of [[C, A], [D, B], [F, H], [E, Gp]]) g.segment(p, q);
    g.polygon([K, L, N, M], { fill: true, aux: true, name: 'KN' });
    g.polygon([O, Pp, R, Q], { fill: true, aux: true, name: 'OR' });
    g.segment(U, S, { colour: 'red' });
    g.segment(D, Gp, { colour: 'blue' });
    g.segment(D, E, { aux: true });
    g.segment(B, Gp, { aux: true });
    g.segment(O, Pp, { aux: true });
    g.equal('UT = TS', dist(U, T), dist(T, S));
    g.equal('DT = TG', dist(D, T), dist(T, Gp));
    g.claim('T lies on US (DUE and BSG straight)', distLine(T, U, S) < 1e-9 && distLine(U, D, E) < 1e-9 && distLine(S, B, Gp) < 1e-9);
  },
});
