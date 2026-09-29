import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { checkSolid, diameter, v3 } from './lib';

// The cube in a sphere. On the left, the diameter AB cut at C with AC = 2CB, the semicircle ADB and
// DB. On the right, the square EFGH with side DB, and EK, FL, GM, HN set up at right angles to it
// and equal to its side: the cube FN. The sphere on the diagonal KG passes through every corner.
export default figure({
  dim: 3,
  camera: { yaw: 0.3, pitch: 0.3 },
  build(g) {
    const d = g.param('d', 3, { min: 2, max: 4, label: 'diameter AB' });
    const R = d / 2;
    const dg = diameter(g, v3(-R - 0.6 - d, 0, -R), d, 2 / 3);
    const { A, B, D } = dg;
    g.segment(D, B);
    const s = dg.DB;
    const h = s / 2;
    const E = g.point('E', v3(-h, -h, -h));
    const F = g.point('F', v3(h, -h, -h));
    const G = g.point('G', v3(h, h, -h));
    const H = g.point('H', v3(-h, h, -h));
    const K = g.point('K', v3(-h, -h, h));
    const L = g.point('L', v3(h, -h, h));
    const M = g.point('M', v3(h, h, h));
    const N = g.point('N', v3(-h, h, h));
    const O = v3(0, 0, 0);
    g.sphere(O, R, { aux: true });
    const faces = [
      [E, F, G, H],
      [K, L, M, N],
      [E, F, L, K],
      [F, G, M, L],
      [G, H, N, M],
      [H, E, K, N],
    ];
    for (const f of faces) g.polygon(f, { fill: true });
    g.curve([E, F, G, H, E, K, L, M, N, K, L, F, G, M, N, H], { aux: true, name: 'FN' });
    g.segment(K, G, { aux: true, dashed: true });
    g.segment(E, G, { aux: true, dashed: true });
    g.segment(F, K, { aux: true, dashed: true });
    const pts = [E, F, G, H, K, L, M, N];
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    const e = checkSolid(g, 'cube', pts, edges, O, R, 12);
    g.equal('KG = AB', dist(K, G), dist(A, B));
    g.equal('□AB = 3 □(side)', d * d, 3 * e * e);
    g.show('side ÷ diameter = √(1/3)', (e / d).toFixed(6));
  },
});
