import { figure } from '../../geometry/figure';
import { dist, mid } from '../../geometry/vec';
import { convexVol, solid, TETRA_FACES, tetra, v3 } from './lib';

// The pyramid ABCD (base ABC, vertex D) cut through the midpoints of its six edges into two small
// pyramids AEGH, HKLD, similar to the whole, and two equal prisms.
export default figure({
  dim: 3,
  camera: { yaw: -0.35, pitch: 0.3 },
  build(g) {
    const h = g.param('h', 2.6, { min: 1.4, max: 3.4, label: 'height' });
    const lean = g.param('lean', 0.3, { min: -1, max: 1, label: 'lean of the vertex' });
    const A = g.point('A', v3(-1.9, -0.7, 0));
    const B = g.point('B', v3(1.7, -1.1, 0));
    const C = g.point('C', v3(0.5, 1.3, 0));
    const D = g.point('D', v3(0.1 + lean, 0.1 - 0.3 * lean, h));
    const E = g.point('E', mid(A, B));
    const F = g.point('F', mid(B, C));
    const G = g.point('G', mid(C, A));
    const H = g.point('H', mid(A, D));
    const K = g.point('K', mid(D, B));
    const L = g.point('L', mid(D, C));
    // the whole pyramid, as a wireframe
    g.path(A, B, C, A, { aux: true });
    g.path(A, D, B, { aux: true });
    g.segment(D, C, { aux: true });
    g.curve([A, B, C, A, D, B, D, C], { aux: true, name: 'ABCD' });
    // the two pyramids
    solid(g, [A, E, G, H], TETRA_FACES, { name: 'AEGH', colour: 'red' });
    solid(g, [H, K, L, D], TETRA_FACES, { name: 'HKLD', colour: 'red' });
    // the two prisms, sharing the face HKFG
    const face = (ps: typeof A[]) => g.polygon(ps, { fill: true });
    face([E, B, F, G]);
    face([B, K, F]);
    face([E, H, G]);
    face([E, B, K, H]);
    face([H, K, F, G]);
    face([G, F, C]);
    face([H, K, L]);
    face([K, F, C, L]);
    face([L, C, G, H]);
    g.segment(E, F, { aux: true, dashed: true });
    g.segment(E, K, { aux: true, dashed: true });
    const whole = tetra(A, B, C, D);
    const pyr1 = tetra(A, E, G, H);
    const pyr2 = tetra(H, K, L, D);
    const prism1 = convexVol([E, B, F, G, H, K], [[0, 1, 2, 3], [1, 5, 2], [0, 4, 3], [0, 1, 5, 4], [4, 5, 2, 3]]);
    const prism2 = convexVol([G, F, C, H, K, L], [[0, 1, 2], [3, 4, 5], [4, 1, 2, 5], [5, 2, 0, 3], [3, 4, 1, 0]]);
    g.equal('AE = HK', dist(A, E), dist(H, K));
    g.equal('EH = KD', dist(E, H), dist(K, D));
    g.equal('pyramid AEGH = pyramid HKLD', pyr1, pyr2);
    g.equal('pyramid HKLD = ⅛ ABCD', pyr2, whole / 8);
    g.equal('prism on EBFG = prism on GFC', prism1, prism2);
    g.equal('the two prisms = ¾ of ABCD', prism1 + prism2, (3 / 4) * whole);
    g.claim('the two prisms > ½ ABCD', prism1 + prism2 > whole / 2);
    g.equal('pyramids + prisms = ABCD', pyr1 + pyr2 + prism1 + prism2, whole);
  },
});
