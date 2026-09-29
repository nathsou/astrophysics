import { figure } from '../../geometry/figure';
import { add, mul, sub } from '../../geometry/vec';
import { centroid, convexVol, PRISM_FACES, TETRA_FACES, tetra, v3, type Tet } from './lib';

// The prism ABC–DEF cut by the planes through BD, EC, CD into three pyramids of equal volume:
// ABD with vertex C, EBC with vertex D, and ECF with vertex D. The slider pulls the three apart.
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: 0.28 },
  build(g) {
    const h = g.param('h', 2.2, { min: 1.2, max: 3, label: 'height' });
    const skew = g.param('skew', 0.5, { min: -1, max: 1, label: 'slant of the prism' });
    const apart = g.param('apart', 0, { min: 0, max: 1.2, label: 'pull apart' });
    const A = g.point('A', v3(-1.6, -0.9, 0));
    const B = g.point('B', v3(1.7, -0.7, 0));
    const C = g.point('C', v3(0, 1.2, 0));
    const up = v3(skew, 0.2 * skew, h);
    const D = g.point('D', add(A, up));
    const E = g.point('E', add(B, up));
    const F = g.point('F', add(C, up));
    const pr = [A, B, C, D, E, F];
    g.curve([A, B, C, A, D, E, F, D, E, B, C, F], { aux: true, name: 'ABCDEF' });
    const mid = centroid(pr);
    const pieces: Tet[] = [
      [A, B, D, C],
      [E, B, C, D],
      [E, C, F, D],
    ];
    pieces.forEach((t, i) => {
      const shift = mul(sub(centroid(t), mid), 2.6 * apart);
      const q = t.map((p) => add(p, shift));
      for (const f of TETRA_FACES) g.polygon(f.map((j) => q[j]), { fill: true, colour: (['red', 'blue', 'yellow'] as const)[i] });
    });
    g.segment(B, D, { aux: true });
    g.segment(E, C, { aux: true });
    g.segment(C, D, { aux: true });
    const prism = convexVol(pr, PRISM_FACES);
    const [p1, p2, p3] = pieces.map((t) => tetra(...t));
    g.equal('pyramid ABD–C = pyramid EBC–D', p1, p2);
    g.equal('pyramid EBC–D = pyramid ECF–D', p2, p3);
    g.equal('pyramid ABC–D = ⅓ prism ABCDEF', tetra(A, B, C, D), prism / 3);
    g.equal('the three pyramids fill the prism', p1 + p2 + p3, prism);
  },
});
