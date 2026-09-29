import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { area3, cone, ngonArea, pyramidFaces, pyramidVol, ring, v3 } from './lib';

// Cones of the same height on the circles ABCD and EFGH, with axes KL and MN (K, M the centres of
// the bases, L, N the vertices) and diameters AC, EG. The octagons DTAUBVCW and HPEQFRGS are
// similar, and the pyramids on them are to one another as the circles.
export default figure({
  dim: 3,
  camera: { yaw: -0.35, pitch: 0.35 },
  build(g) {
    const h = g.param('h', 2.6, { min: 1.5, max: 3.5, label: 'common height' });
    const r2 = g.param('r', 1.0, { min: 0.6, max: 1.5, label: 'radius of EFGH' });
    const k = g.param('k', 1, { min: 0, max: 4, label: 'doublings' });
    const r1 = 1.5;
    const K = g.point('K', v3(-2.2, 0, 0));
    const M = g.point('M', v3(2.0, 0, 0));
    const L = g.point('L', v3(-2.2, 0, h));
    const N = g.point('N', v3(2.0, 0, h));
    const t0 = (215 * Math.PI) / 180;
    // going round: D, T, A, U, B, V, C, W and H, P, E, Q, F, R, G, S
    const [D, T, A, U, B, Vv, C, W] = ring(K, r1, 8, t0);
    const [H, P, E, Q, F, R, G, S] = ring(M, r2, 8, t0);
    const pts = g.points({ A, B, C, D, E, F, G, H, P, Q, R, S, T, U, V: Vv, W });
    cone(g, K, r1, L, pts.A, 'AL');
    cone(g, M, r2, N, pts.E, 'EN');
    g.segment(K, L, { aux: true, dashed: true });
    g.segment(M, N, { aux: true, dashed: true });
    g.segment(pts.A, pts.C, { aux: true });
    g.segment(pts.E, pts.G, { aux: true });
    g.polygon([pts.E, pts.F, pts.G, pts.H], { aux: true });
    const oct1 = [pts.D, pts.T, pts.A, pts.U, pts.B, pts.V, pts.C, pts.W];
    const oct2 = [pts.H, pts.P, pts.E, pts.Q, pts.F, pts.R, pts.G, pts.S];
    for (const [oct, apex] of [
      [oct1, L],
      [oct2, N],
    ] as const) {
      g.polygon(oct, { fill: true });
      for (const f of pyramidFaces(8).slice(1)) g.polygon(f.map((i) => [...oct, apex][i]), { fill: true });
    }
    const n = 4 * 2 ** k;
    if (k > 1) {
      g.curve(ring(K, r1, n, t0), { closed: true, aux: true });
      g.curve(ring(M, r2, n, t0), { closed: true, aux: true });
    }
    const sq = dist(pts.A, pts.C) ** 2 / dist(pts.E, pts.G) ** 2;
    g.equal('DTAUBVCW : HPEQFRGS = □AC : □EG', area3(oct1) / area3(oct2), sq);
    const p1 = pyramidVol(ring(K, r1, n, t0), L);
    const p2 = pyramidVol(ring(M, r2, n, t0), N);
    g.equal(`pyramid on the ${n}-gon in ABCD : in EFGH = □AC : □EG`, p1 / p2, sq);
    g.show(`${n}-gon ÷ circle`, (ngonArea(n, 1) / Math.PI).toFixed(5));
    g.equal('circle ABCD : circle EFGH = □AC : □EG', (Math.PI * r1 * r1) / (Math.PI * r2 * r2), sq);
  },
  unresolved: {
    O: 'the solid O, supposed to be the fourth proportional; it cannot be less or greater than the cone EN',
    X: 'the solid X, the supposed difference between the cone EN and the solid O',
  },
});
