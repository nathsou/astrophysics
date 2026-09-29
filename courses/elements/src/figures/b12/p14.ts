import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { cone, v3 } from './lib';

// Cylinders EB and FD on equal bases, the circles AB and CD, with axes GH and KL, and the cones ABG
// and CDK inside them. KL is produced to N with LN = GH, and the cylinder CM is imagined on LN.
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: 0.32 },
  build(g) {
    const h1 = g.param('h1', 2.2, { min: 1, max: 3, label: 'axis GH' });
    const h2 = g.param('h2', 1.4, { min: 0.8, max: 2.6, label: 'axis KL' });
    const r = 0.95;
    const up = v3(0, 0, 1);
    const x1 = -1.9;
    const x2 = 1.6;
    const H = g.point('H', v3(x1, 0, 0));
    const G = g.point('G', v3(x1, 0, h1));
    const A = g.point('A', v3(x1 - r, 0, 0));
    const B = g.point('B', v3(x1 + r, 0, 0));
    const E = g.point('E', v3(x1 - r, 0, h1));
    const L = g.point('L', v3(x2, 0, 0));
    const K = g.point('K', v3(x2, 0, h2));
    const C = g.point('C', v3(x2 - r, 0, 0));
    const D = g.point('D', v3(x2 + r, 0, 0));
    const F = g.point('F', v3(x2 - r, 0, h2));
    const N = g.point('N', v3(x2, 0, -h1));
    const M = g.point('M', v3(x2 + r, 0, -h1));
    cone(g, H, r, G, A, 'ABG');
    cone(g, L, r, K, C, 'CDK');
    g.circle3(G, up, r);
    g.circle3(K, up, r);
    g.circle3(N, up, r, { aux: true, dashed: true });
    g.segment(G, H, { aux: true, dashed: true });
    g.segment(K, L, { aux: true, dashed: true });
    g.segment(L, N, { aux: true, dashed: true });
    // the sections through the axes, which name the cylinders by a diagonal
    g.polygon([E, v3(x1 + r, 0, h1), B, A], { fill: true, name: 'EB' });
    g.polygon([F, v3(x2 + r, 0, h2), D, C], { fill: true, name: 'FD' });
    g.polygon([C, D, M, v3(x2 - r, 0, -h1)], { aux: true, dashed: true, name: 'CM' });
    g.polygon([F, v3(x2 + r, 0, h2), M, v3(x2 - r, 0, -h1)], { aux: true, name: 'FM' });
    const cyl = (h: number) => Math.PI * r * r * h;
    const GH = dist(G, H);
    const KL = dist(K, L);
    g.equal('cylinder CM = cylinder EB', cyl(dist(L, N)), cyl(GH));
    g.equal('cylinder EB : cylinder FD = GH : KL', cyl(GH) / cyl(KL), GH / KL);
    g.equal('cone ABG : cone CDK = GH : KL', cyl(GH) / 3 / (cyl(KL) / 3), GH / KL);
  },
});
