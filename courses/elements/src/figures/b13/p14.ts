import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { checkSolid, diameter, v3 } from './lib';

// The octahedron in a sphere. On the left, the diameter AB bisected at C, the semicircle ADB and
// DB. On the right, the square EFGH with side DB and diagonals meeting at K; KL and KM, at right
// angles to its plane on either side, are equal to KE. The sphere on LM passes through E, F, G, H.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: 0.35 },
  build(g) {
    const d = g.param('d', 3, { min: 2, max: 4, label: 'diameter AB' });
    const R = d / 2;
    const dg = diameter(g, v3(-R - 0.6 - d, 0, -R), d, 1 / 2);
    const { A, B, D } = dg;
    g.segment(D, B);
    const K = g.point('K', v3(0, 0, 0));
    const s = dg.DB;
    const r = s / Math.SQRT2;
    const sq = [0, 1, 2, 3].map((i) => v3(r * Math.cos(-2 + (Math.PI / 2) * i), r * Math.sin(-2 + (Math.PI / 2) * i), 0));
    const E = g.point('E', sq[0]);
    const F = g.point('F', sq[1]);
    const G = g.point('G', sq[2]);
    const H = g.point('H', sq[3]);
    const L = g.point('L', v3(0, 0, r));
    const M = g.point('M', v3(0, 0, -r));
    g.sphere(K, r, { aux: true });
    g.polygon([E, F, G, H], { aux: true });
    g.segment(H, F, { aux: true });
    g.segment(E, G, { aux: true });
    g.segment(L, M, { aux: true, dashed: true });
    const ring = [E, F, G, H];
    for (let i = 0; i < 4; i++) {
      g.polygon([L, ring[i], ring[(i + 1) % 4]], { fill: true });
      g.polygon([M, ring[i], ring[(i + 1) % 4]], { fill: true });
    }
    const pts = [E, F, G, H, L, M];
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      ...[0, 1, 2, 3].flatMap((i) => [
        [4, i] as [number, number],
        [5, i] as [number, number],
      ]),
    ];
    const e = checkSolid(g, 'octahedron', pts, edges, K, R, 12);
    g.equal('LM = AB', dist(L, M), dist(A, B));
    g.equal('□AB = 2 □(side)', d * d, 2 * e * e);
    g.show('side ÷ diameter = √(1/2)', (e / d).toFixed(6));
  },
});
