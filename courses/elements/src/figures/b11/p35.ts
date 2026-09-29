import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, dirWithAngles, footLine, footPlane, ground, mul, sph, sub, v3, Z3, type V } from './lib';

// Two equal plane angles BAC, EDF, with elevated lines AG, DM making equal angles with the
// corresponding arms: the lines make equal angles with their planes. On the left, AH = DM and HK is
// the perpendicular to the plane; KB, KC fall perpendicular on AB, AC.
export default figure({
  dim: 3,
  camera: { yaw: -0.1, pitch: -0.62 },
  build(g) {
    const th = g.param('th', 1.2, { min: 0.8, max: 1.7, label: 'angle BAC = EDF' });
    const psi = g.param('psi', 0.45, { min: 0.25, max: 0.75, label: 'direction of AG' });
    const el = g.param('el', 0.9, { min: 0.6, max: 1.2, label: 'elevation of AG' });
    const rho = g.param('rho', 0.5, { min: 0, max: 1.2, label: 'turn of EDF' });
    const P = (n: string, p: V) => g.point(n, p);
    ground(g, -3.3, 2.9, -1.1, 1.3);
    // the angle BAC and the elevated line AG (the arms are drawn beyond B, C)
    const A = P('A', v3(-2.9, -0.8, 0));
    const b0 = -0.1;
    const ab = add(A, mul(sph(b0), 2.3));
    const ac = add(A, mul(sph(b0 + th), 2.1));
    const gdir = sph(b0 + psi * th, el);
    const Gp = P('G', add(A, mul(gdir, 2.5)));
    const L = P('L', footPlane(Gp, A, Z3));
    // the equal angle EDF, and DM making the same angles with its arms as AG with AB, AC
    const D = P('D', v3(0.5, -0.9, 0));
    const de = add(D, mul(sph(b0 + rho), 2.1));
    const df = add(D, mul(sph(b0 + rho + th), 2.1));
    const mdir = dirWithAngles(sub(de, D), sub(df, D), angle(Gp, A, ab), angle(Gp, A, ac), Z3);
    const dm = 1.8;
    const M = P('M', add(D, mul(mdir, dm)));
    const N = P('N', footPlane(M, D, Z3));
    // AH = DM and HK parallel to GL; B, C, E, F are the feet of the perpendiculars from K, N
    const H = P('H', add(A, mul(gdir, dm)));
    const K = P('K', footPlane(H, A, Z3));
    const B = P('B', footLine(K, A, ab));
    const C = P('C', footLine(K, A, ac));
    const E = P('E', footLine(N, D, de));
    const F = P('F', footLine(N, D, df));
    g.path(ab, A, ac);
    g.path(de, D, df);
    g.segment(A, Gp, { colour: 'red' });
    g.segment(D, M, { colour: 'red' });
    g.segment(Gp, L, { aux: true });
    g.segment(M, N, { aux: true });
    g.segment(L, A, { aux: true, dashed: true });
    g.segment(N, D, { aux: true, dashed: true });
    g.segment(H, K, { aux: true });
    for (const [x, y] of [[K, B], [K, C], [N, E], [N, F], [H, C], [C, B], [M, F], [F, E]]) g.segment(x, y, { aux: true });
    g.angle(K, C, A, { right: true });
    g.angle(N, F, D, { right: true });
    g.angle(Gp, A, L);
    g.angle(M, D, N);
    g.equal('∠GAL = ∠MDN', deg(angle(Gp, A, L)), deg(angle(M, D, N)));
    g.equal('HK = MN', dist(H, K), dist(M, N));
    g.equal('∠HCA = 90°', deg(angle(H, C, A)), 90);
    g.equal('AC = DF', dist(A, C), dist(D, F));
    g.equal('BC = EF', dist(B, C), dist(E, F));
  },
});
