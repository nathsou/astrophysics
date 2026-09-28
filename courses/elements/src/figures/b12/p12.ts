import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { cone, pyramidFaces, pyramidVol, ring, tetra, v3 } from './lib';

// Similar cones: the circles ABCD, EFGH with centres K, M, diameters BD, FH, and vertices L, N; the
// second cone is the first scaled by s. The similar octagons ATBUCVDW and EPFQGRHS carry similar
// pyramids, which are cut into small pyramids such as BKTL and FMPN.
export default figure({
  dim: 3,
  camera: { yaw: -0.35, pitch: 0.35 },
  build(g) {
    const h = g.param('h', 2.6, { min: 1.5, max: 3.5, label: 'height of ABCDL' });
    const s = g.param('s', 0.65, { min: 0.4, max: 1.2, label: 'EFGHN ÷ ABCDL' });
    const r1 = 1.5;
    const K = g.point('K', v3(-2.2, 0, 0));
    const L = g.point('L', v3(-2.2, 0, h));
    const M = g.point('M', v3(2.0, 0, 0));
    const N = g.point('N', v3(2.0, 0, s * h));
    const t0 = (200 * Math.PI) / 180;
    const [A, T, B, U, C, Vv, D, W] = ring(K, r1, 8, t0);
    const [E, P, F, Q, G, R, H, S] = ring(M, s * r1, 8, t0);
    const pts = g.points({ A, B, C, D, E, F, G, H, P, Q, R, S, T, U, V: Vv, W });
    cone(g, K, r1, L, pts.B, 'ABCDL');
    cone(g, M, s * r1, N, pts.F, 'EFGHN');
    g.segment(K, L, { aux: true, dashed: true });
    g.segment(M, N, { aux: true, dashed: true });
    g.segment(pts.B, pts.D, { aux: true });
    g.segment(pts.F, pts.H, { aux: true });
    g.segment(K, pts.T, { aux: true });
    g.segment(M, pts.P, { aux: true });
    const oct1 = [pts.A, pts.T, pts.B, pts.U, pts.C, pts.V, pts.D, pts.W];
    const oct2 = [pts.E, pts.P, pts.F, pts.Q, pts.G, pts.R, pts.H, pts.S];
    for (const [oct, apex] of [
      [oct1, L],
      [oct2, N],
    ] as const) {
      g.polygon(oct, { aux: true });
      for (const f of pyramidFaces(8).slice(1)) g.polygon(f.map((i) => [...oct, apex][i]), { aux: true });
    }
    // the small pyramids BKTL, FMPN
    g.polygon([pts.B, K, pts.T], { fill: true });
    g.polygon([L, pts.B, pts.T], { fill: true });
    g.polygon([L, K, pts.T], { fill: true });
    g.polygon([L, K, pts.B], { fill: true });
    g.polygon([pts.F, M, pts.P], { fill: true });
    g.polygon([N, pts.F, pts.P], { fill: true });
    g.polygon([N, M, pts.P], { fill: true });
    g.polygon([N, M, pts.F], { fill: true });
    const r = dist(pts.B, pts.D) / dist(pts.F, pts.H);
    g.equal('BD : FH = KL : MN', r, dist(K, L) / dist(M, N));
    g.equal('LB : BT = NF : FP', dist(L, pts.B) / dist(pts.B, pts.T), dist(N, pts.F) / dist(pts.F, pts.P));
    g.equal('pyramid BKTL : pyramid FMPN = (BK : FM)³', tetra(pts.B, K, pts.T, L) / tetra(pts.F, M, pts.P, N), (dist(pts.B, K) / dist(pts.F, M)) ** 3);
    g.equal('pyramid on ATBUCVDW : on EPFQGRHS = (BD : FH)³', pyramidVol(oct1, L) / pyramidVol(oct2, N), r ** 3);
  },
  unresolved: { O: 'the solid O, supposed less (then greater) than the cone EFGHN; it cannot exist' },
});
