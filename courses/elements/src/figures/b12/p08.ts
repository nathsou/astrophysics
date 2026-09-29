import { figure } from '../../geometry/figure';
import { add, dist, mul, sub, type V } from '../../geometry/vec';
import { BOX_FACES, convexVol, edgeWalk, faceEdges, solid, TETRA_FACES, tetra, v3 } from './lib';

// Similar pyramids ABCG and DEFH (the second is the first scaled by k). On the edges BA, BC, BG the
// parallelepiped BGML is completed, and on ED, EF, EH the parallelepiped EHQP; each pyramid is a
// sixth of its parallelepiped.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: 0.3 },
  build(g) {
    const k = g.param('k', 0.65, { min: 0.3, max: 1.2, label: 'DEFH ÷ ABCG (sides)' });
    const lean = g.param('lean', 0.3, { min: -0.6, max: 0.8, label: 'lean of G' });
    const A = g.point('A', v3(-3.6, 1.0, 0));
    const B = g.point('B', v3(-3.3, -0.9, 0));
    const C = g.point('C', v3(-1.2, -0.6, 0));
    const G = g.point('G', v3(-2.6 + lean, 0.3, 1.9));
    // DEFH: ABCG scaled by k about B, then moved to the right
    const o = v3(1.2, -0.9, 0);
    const sim = (p: V) => add(o, mul(sub(p, B), k));
    const D = g.point('D', sim(A));
    const E = g.point('E', sim(B));
    const F = g.point('F', sim(C));
    const H = g.point('H', sim(G));
    const par = (b: V, a: V, c: V, gg: V, names: [string, string, string, string]) => {
      const M = g.point(names[0], add(a, sub(c, b)));
      const K = g.point(names[1], add(a, sub(gg, b)));
      const N = g.point(names[2], add(c, sub(gg, b)));
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
    const r = dist(B, C) / dist(E, F);
    const v1 = convexVol(box1, BOX_FACES);
    const v2 = convexVol(box2, BOX_FACES);
    g.equal('AB : DE = BC : EF', dist(A, B) / dist(D, E), r);
    g.equal('pyramid ABCG = ⅙ solid BGML', tetra(A, B, C, G), v1 / 6);
    g.equal('BGML : EHQP = (BC : EF)³', v1 / v2, r ** 3);
    g.equal('ABCG : DEFH = (BC : EF)³', tetra(A, B, C, G) / tetra(D, E, F, H), r ** 3);
  },
});
