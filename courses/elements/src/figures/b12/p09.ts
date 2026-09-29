import { figure } from '../../geometry/figure';
import { add, mul, sub, type V } from '../../geometry/vec';
import { area3, BOX_FACES, convexVol, edgeWalk, faceEdges, planeDist, solid, TETRA_FACES, tetra, v3 } from './lib';

// Equal pyramids ABCG and DEFH: the base DEF is the base ABC scaled by s, and the height of DEFH
// is the height of ABCG divided by s², so the bases are reciprocally proportional to the heights.
// The parallelepipeds BGML and EHQP are completed as in XII.8.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: 0.28 },
  build(g) {
    const h = g.param('h', 1.4, { min: 0.9, max: 2, label: 'height of ABCG' });
    const s = g.param('s', 0.72, { min: 0.6, max: 0.9, label: 'DEF ÷ ABC (sides)' });
    const A = g.point('A', v3(-3.8, 1.0, 0));
    const B = g.point('B', v3(-3.5, -0.9, 0));
    const C = g.point('C', v3(-1.3, -0.6, 0));
    const G = g.point('G', v3(-2.5, 0.2, h));
    const o = v3(1.0, -0.9, 0);
    const sc = (p: V) => add(o, mul(sub(p, B), s));
    const D = g.point('D', sc(A));
    const E = g.point('E', sc(B));
    const F = g.point('F', sc(C));
    const H = g.point('H', add(sc(v3(G.x, G.y, 0)), v3(0.2, 0, h / (s * s))));
    const par = (b: V, a: V, c: V, gg: V, names: [string, string, string, string]) => {
      const M = g.point(names[0], add(a, sub(c, b)));
      const K = g.point(names[1], add(a, sub(gg, b)), { hidden: true });
      const N = g.point(names[2], add(c, sub(gg, b)), { hidden: true });
      const L = g.point(names[3], add(M, sub(gg, b)));
      return [b, a, c, gg, M, K, N, L];
    };
    const box1 = par(B, A, C, G, ['M', 'K', 'N', 'L']);
    const box2 = par(E, D, F, H, ['Q', 'O', 'R', 'P']);
    for (const bx of [box1, box2]) for (const f of BOX_FACES) g.polygon(f.map((i) => bx[i]), { aux: true });
    g.curve(edgeWalk(box1, faceEdges(BOX_FACES)), { aux: true, name: 'BGML' });
    g.curve(edgeWalk(box2, faceEdges(BOX_FACES)), { aux: true, name: 'EHQP' });
    solid(g, [A, B, C, G], TETRA_FACES, { name: 'ABCG' });
    solid(g, [D, E, F, H], TETRA_FACES, { name: 'DEFH' });
    g.segment(G, v3(G.x, G.y, 0), { aux: true, dashed: true });
    g.segment(H, v3(H.x, H.y, 0), { aux: true, dashed: true });
    const h1 = planeDist(G, A, B, C);
    const h2 = planeDist(H, D, E, F);
    g.equal('ABC : DEF = height of DEFH : height of ABCG', area3([A, B, C]) / area3([D, E, F]), h2 / h1);
    g.equal('solid BGML = solid EHQP', convexVol(box1, BOX_FACES), convexVol(box2, BOX_FACES));
    g.equal('pyramid ABCG = pyramid DEFH', tetra(A, B, C, G), tetra(D, E, F, H));
  },
});
