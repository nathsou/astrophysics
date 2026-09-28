import { figure } from '../../geometry/figure';
import { add } from '../../geometry/vec';
import { area3, pyramidFaces, pyramidVol, solid, v3 } from './lib';

// Pyramids of the same height on the pentagons ABCDE and FGHKL, with vertices M and N. The
// diagonals AC, AD and FH, FK cut them into pyramids on triangles, to which XII.5 applies.
export default figure({
  dim: 3,
  camera: { yaw: -0.2, pitch: 0.32 },
  build(g) {
    const h = g.param('h', 2.3, { min: 1.2, max: 3.2, label: 'common height' });
    const s = g.param('s', 0.8, { min: 0.5, max: 1.1, label: 'size of FGHKL' });
    const lean = g.param('lean', 0.4, { min: -0.8, max: 0.8, label: 'lean of N' });
    const A = g.point('A', v3(-4.3, -0.3, 0));
    const B = g.point('B', v3(-3.1, -1.3, 0));
    const C = g.point('C', v3(-1.3, -0.8, 0));
    const D = g.point('D', v3(-1.2, 0.9, 0));
    const E = g.point('E', v3(-3.3, 1.2, 0));
    const M = g.point('M', v3(-2.7, 0.0, h));
    const o = v3(2.6, 0, 0);
    const at = (x: number, y: number) => add(o, v3(s * x, s * y, 0));
    const F = g.point('F', at(-1.8, -0.4));
    const G = g.point('G', at(-0.4, -1.5));
    const H = g.point('H', at(1.6, -0.6));
    const K = g.point('K', at(1.2, 1.2));
    const L = g.point('L', at(-1.0, 1.3));
    const N = g.point('N', add(at(0, 0), v3(lean, 0, h)));
    const b1 = [A, B, C, D, E];
    const b2 = [F, G, H, K, L];
    solid(g, [...b1, M], pyramidFaces(5), { name: 'ABCDEM' });
    solid(g, [...b2, N], pyramidFaces(5), { name: 'FGHKLN' });
    g.segment(A, C, { aux: true });
    g.segment(A, D, { aux: true });
    g.segment(F, H, { aux: true });
    g.segment(F, K, { aux: true });
    g.segment(M, v3(M.x, M.y, 0), { aux: true, dashed: true });
    g.segment(N, v3(N.x, N.y, 0), { aux: true, dashed: true });
    const ratio = area3(b1) / area3(b2);
    g.equal('ABCM : ACDM = ABC : ACD', pyramidVol([A, B, C], M) / pyramidVol([A, C, D], M), area3([A, B, C]) / area3([A, C, D]));
    g.equal('ADEM : FGHN = ADE : FGH', pyramidVol([A, D, E], M) / pyramidVol([F, G, H], N), area3([A, D, E]) / area3([F, G, H]));
    g.equal('ABCDEM : FGHKLN = ABCDE : FGHKL', pyramidVol(b1, M) / pyramidVol(b2, N), ratio);
  },
});
