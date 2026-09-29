import { figure } from '../../geometry/figure';
import { add, area3, box, boxVolume, drawBox, mul, prismVolume, sph, sub, v3, X3, type V } from './lib';

// Two prisms of equal height, one on a parallelogram AF, the other on a triangle GHK with AF double
// of GHK, are equal: each is half of a parallelepiped (XI.28), and the parallelepipeds are equal
// by XI.31.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.35 },
  build(g) {
    const h = g.param('h', 1.4, { min: 0.9, max: 1.9, label: 'height' });
    const ang = g.param('ang', 1.2, { min: 0.8, max: 1.8, label: 'angle of the base AF' });
    const tri = g.param('tri', 1.7, { min: 1.2, max: 2.1, label: 'side GK' });
    const P = (n: string, p: V) => g.point(n, p);
    // the triangle GHK and its prism GHK-LMN (top shifted, same height)
    const G0 = v3(0.6, -0.6, 0);
    const Gp = P('G', G0);
    const H = P('H', add(G0, mul(sph(1.7), 1.4)));
    const K = P('K', add(G0, mul(X3, tri)));
    const t = v3(0.3, 0.2, h);
    const L = P('L', add(Gp, t));
    const M = P('M', add(H, t));
    const N = P('N', add(K, t));
    const X = add(H, sub(K, Gp));
    const Pt = P('P', add(X, t));
    // the parallelogram AF (A B F E) with area 2·△GHK, and the prism on it with ridge DC
    const areaT = area3([Gp, H, K]);
    const A = P('A', v3(-3.6, -0.6, 0));
    const p = mul(X3, 1.9);
    const q = mul(sph(ang), (2 * areaT) / (1.9 * Math.sin(ang)));
    const B = P('B', add(A, p));
    const E = P('E', add(A, q));
    const F = P('F', add(add(A, p), q));
    const r = v3(0.2 + q.x * 0.35, q.y * 0.35, h);
    const D = P('D', add(A, r));
    const C = P('C', add(B, r));
    const bAO = box(A, p, q, r);
    P('O', bAO[6]);
    const bGP = [Gp, H, X, K, L, M, Pt, N];
    drawBox(g, bAO, { aux: true, dashed: true });
    drawBox(g, bGP, { aux: true, dashed: true });
    // prism ABCDEF: triangles AED, BFC
    g.polygon([A, B, F, E], { fill: true, name: 'AF' });
    g.polygon([A, E, D], { fill: true });
    g.polygon([B, F, C], { fill: true });
    g.polygon([D, C, F, E], { fill: true, aux: true });
    g.polygon([A, B, C, D], { fill: true, aux: true });
    // prism GHKLMN
    g.polygon([Gp, H, K], { fill: true });
    g.polygon([L, M, N], { fill: true });
    g.segment(Gp, L);
    g.segment(H, M);
    g.segment(K, N);
    g.polygon([H, Gp, K, X], { aux: true, name: 'HK' });
    const v1 = prismVolume([A, E, D], [B, F, C]);
    const v2 = prismVolume([Gp, H, K], [L, M, N]);
    g.equal('▱AF = 2 △GHK', area3([A, B, F, E]), 2 * areaT);
    g.equal('solid AO = solid GP', boxVolume(bAO), boxVolume(bGP));
    g.equal('prism ABCDEF = prism GHKLMN', v1, v2);
  },
});
