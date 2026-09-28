import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { checkSolid, diameter, v3 } from './lib';

// The pyramid (tetrahedron) in a sphere. On the left, the given diameter AB cut at C with AC = 2CB,
// the semicircle ADB and the perpendicular CD. On the right, the circle EFG with radius DC and the
// equilateral triangle EFG in it; HK, at right angles to its plane, equals AC and HL, below, equals
// CB. The sphere on KL passes through E, F, G and K.
export default figure({
  dim: 3,
  camera: { yaw: -0.35, pitch: 0.38 },
  build(g) {
    const d = g.param('d', 3, { min: 2, max: 4, label: 'diameter AB' });
    const R = d / 2;
    const dg = diameter(g, v3(-R - 0.5 - d, 0, -R), d, 2 / 3);
    const { A, B, C, D } = dg;
    g.segment(D, A);
    const AC = dist(A, C);
    const CB = dist(C, B);
    const H = g.point('H', v3(0, 0, R - AC));
    const K = g.point('K', v3(0, 0, R));
    const L = g.point('L', v3(0, 0, -R));
    const r = dg.DC;
    const tri = [0, 1, 2].map((i) => v3(r * Math.cos((-110 * Math.PI) / 180 + (2 * Math.PI * i) / 3), r * Math.sin((-110 * Math.PI) / 180 + (2 * Math.PI * i) / 3), H.z!));
    const E = g.point('E', tri[0]);
    const F = g.point('F', tri[1]);
    const G = g.point('G', tri[2]);
    const O = v3(0, 0, 0);
    g.sphere(O, R, { aux: true });
    g.circle3(H, v3(0, 0, 1), r, { aux: true });
    g.polygon([E, F, G], { fill: true });
    g.polygon([K, E, F], { fill: true });
    g.polygon([K, F, G], { fill: true });
    g.polygon([K, E, G], { fill: true });
    g.segment(K, L, { aux: true, dashed: true });
    g.path(E, H, F, { aux: true });
    g.segment(H, G, { aux: true });
    g.path(F, L, G, { aux: true, dashed: true });
    g.segment(E, L, { aux: true, dashed: true });
    // the lemma: on AC the square EC, and the rectangle FB completed (below AB)
    const lem = { from: 25 };
    const a2 = dg.at(0, -AC);
    const c2 = dg.at(AC, -AC);
    const b2 = dg.at(d, -AC);
    g.polygon([A, C, c2, a2], { aux: true, name: 'EC', ...lem });
    g.polygon([C, B, b2, c2], { aux: true, name: ['FB', 'BF'], ...lem });
    g.polygon([A, B, b2, a2], { aux: true, name: 'EB', ...lem });
    g.segment(A, a2, { aux: true, name: 'EA', ...lem });
    g.segment(D, B, { aux: true, ...lem });
    const pts = [E, F, G, K];
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 2],
    ];
    const e = checkSolid(g, 'pyramid', pts, edges, O, R, 6);
    g.equal('HK = AC', dist(H, K), AC);
    g.equal('HL = CB', dist(H, L), CB);
    g.equal('KL = AB', dist(K, L), d);
    g.equal('KH·HL = □EH', dist(K, H) * dist(H, L), dist(E, H) ** 2);
    g.equal('□AB = 3/2 □(side)', d * d, 1.5 * e * e);
    g.show('side ÷ diameter = √(2/3)', (e / d).toFixed(6));
  },
});
