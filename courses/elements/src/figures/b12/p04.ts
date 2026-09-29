import { figure } from '../../geometry/figure';
import { add } from '../../geometry/vec';
import { area3, convexVol, divide, exhaust, solid, TETRA_FACES, tetra, v3, type Tet } from './lib';

// Two pyramids of the same height, ABCG and DEFH, each divided as in XII.3. In ABCG: K, O, L bisect
// AB, BC, CA and P, M, N bisect GA, GB, GC; in DEFH: Q, V, R bisect DE, EF, FD and S, T, U bisect
// HD, HE, HF. The prisms of the one are to the prisms of the other as the bases.
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: 0.3 },
  build(g) {
    const h = g.param('h', 2.4, { min: 1.2, max: 3.2, label: 'common height' });
    const s = g.param('s', 0.75, { min: 0.45, max: 1.1, label: 'size of DEF' });
    const A = g.point('A', v3(-4.4, -0.6, 0));
    const B = g.point('B', v3(-1.2, -1.0, 0));
    const C = g.point('C', v3(-2.2, 1.2, 0));
    const G = g.point('G', v3(-2.7, 0.1, h));
    const o2 = v3(2.4, 0, 0);
    const at = (x: number, y: number) => add(o2, v3(s * x, s * y, 0));
    const D = g.point('D', at(-1.5, -1.1));
    const E = g.point('E', at(1.9, -0.5));
    const F = g.point('F', at(-0.2, 1.4));
    const H = g.point('H', add(at(0.2, 0.1), v3(0, 0, h)));
    const one = divide([A, B, C, G]);
    const two = divide([D, E, F, H]);
    // divide() names the midpoints after XII.3 (e on the first edge, …); rename them after XII.4
    const K = g.point('K', one.mids.e);
    const O = g.point('O', one.mids.f);
    const L = g.point('L', one.mids.g);
    const P = g.point('P', one.mids.h);
    const M = g.point('M', one.mids.k);
    const N = g.point('N', one.mids.l);
    const Q = g.point('Q', two.mids.e);
    const Vv = g.point('V', two.mids.f);
    const R = g.point('R', two.mids.g);
    const S = g.point('S', two.mids.h);
    const T = g.point('T', two.mids.k);
    const U = g.point('U', two.mids.l);
    const drawWhole = (t: Tet, name: string) => {
      const [a, b, c, d] = t;
      g.curve([a, b, c, a, d, b, d, c], { aux: true, name });
    };
    drawWhole([A, B, C, G], 'ABCG');
    drawWhole([D, E, F, H], 'DEFH');
    // the prisms, as faces
    const prisms = (d: ReturnType<typeof divide>) => {
      for (const pr of d.prisms) for (const f of pr.faces) g.polygon(f.map((i) => pr.pts[i]), { fill: true });
    };
    prisms(one);
    prisms(two);
    // the pyramids that are left
    solid(g, [A, K, L, P], TETRA_FACES, { name: 'AKLP', faceStyle: { fill: false, aux: true } });
    solid(g, [P, M, N, G], TETRA_FACES, { name: 'PMNG', faceStyle: { fill: false, aux: true } });
    solid(g, [D, Q, R, S], TETRA_FACES, { name: 'DQRS', faceStyle: { fill: false, aux: true } });
    solid(g, [S, T, U, H], TETRA_FACES, { name: 'STUH', faceStyle: { fill: false, aux: true } });
    // the heights
    g.segment(G, v3(G.x, G.y, 0), { aux: true, dashed: true });
    g.segment(H, v3(H.x, H.y, 0), { aux: true, dashed: true });
    const vol = (d: ReturnType<typeof divide>) => d.prisms.reduce((t, q) => t + convexVol(q.pts, q.faces), 0);
    const ratio = area3([A, B, C]) / area3([D, E, F]);
    g.equal('△LOC : △RVF = △ABC : △DEF', area3([L, O, C]) / area3([R, Vv, F]), ratio);
    g.equal('prism LOC–PMN : prism RVF–STU = LOC : RVF', convexVol(one.prisms[1].pts, one.prisms[1].faces) / convexVol(two.prisms[1].pts, two.prisms[1].faces), ratio);
    g.equal('two prisms : two prisms = ABC : DEF', vol(one) / vol(two), ratio);
    g.equal('four prisms : four prisms = ABC : DEF', exhaust([A, B, C, G], 2).prisms / exhaust([D, E, F, H], 2).prisms, ratio);
    g.show('pyramid ABCG : pyramid DEFH', (tetra(A, B, C, G) / tetra(D, E, F, H)).toFixed(4));
  },
});
