import { figure } from '../../geometry/figure';
import { collinear, dist, type V } from '../../geometry/vec';
import { checkSolid, hullFaces, PHI, planeDist, v3 } from './lib';

// The dodecahedron built on a cube with centre Z. ABCD and CBEF are two faces of the cube; G, H, K,
// L, M, N, O bisect AB, BC, CD, DA, EF, EB, FC; P and Q are the centres of the faces CBEF and ABCD.
// NP, PO, HQ are cut in extreme and mean ratio at R, S, T, and RU, SV, TW, set up outside the cube
// at right angles to its faces, are equal to the greater segments. UBWCV is one face of the
// dodecahedron; the same construction on every edge of the cube gives the other eleven.
export default figure({
  dim: 3,
  camera: { yaw: -1.3, pitch: -0.5 },
  build(g) {
    const s = g.param('s', 2.4, { min: 1.5, max: 3, label: 'side of the cube' });
    const whole = g.param('whole', 1, { min: 0, max: 1, label: 'draw the whole dodecahedron' });
    const a = s / 2;
    const f = a / PHI;
    const Z = g.point('Z', v3(0, 0, 0));
    const A = g.point('A', v3(-a, -a, a));
    const B = g.point('B', v3(a, -a, a));
    const C = g.point('C', v3(a, a, a));
    const D = g.point('D', v3(-a, a, a));
    const E = g.point('E', v3(a, -a, -a));
    const F = g.point('F', v3(a, a, -a));
    const G = g.point('G', v3(0, -a, a));
    const H = g.point('H', v3(a, 0, a));
    const K = g.point('K', v3(0, a, a));
    const L = g.point('L', v3(-a, 0, a));
    const M = g.point('M', v3(a, 0, -a));
    const N = g.point('N', v3(a, -a, 0));
    const O = g.point('O', v3(a, a, 0));
    const P = g.point('P', v3(a, 0, 0));
    g.point('Q', v3(0, 0, a));
    const R = g.point('R', v3(a, -f, 0));
    const S = g.point('S', v3(a, f, 0));
    const T = g.point('T', v3(f, 0, a));
    const U = g.point('U', v3(a + f, -f, 0));
    const Vv = g.point('V', v3(a + f, f, 0));
    const W = g.point('W', v3(f, 0, a + f));
    const X = g.point('X', v3(a + f, 0, 0));
    // the cube
    const cube = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => v3(a * x, a * y, a * z))));
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (Math.abs(dist(cube[i], cube[j]) - s) < 1e-9) g.segment(cube[i], cube[j], { aux: true, dashed: true });
    g.polygon([A, B, C, D], { aux: true });
    g.polygon([C, B, E, F], { aux: true });
    g.segment(G, K, { aux: true });
    g.segment(H, L, { aux: true });
    g.segment(M, H, { aux: true });
    g.segment(N, O, { aux: true });
    g.segment(R, U, { aux: true });
    g.segment(S, Vv, { aux: true });
    g.segment(T, W, { aux: true });
    g.segment(P, X, { aux: true });
    g.segment(X, W, { aux: true, dashed: true });
    g.segment(X, Z, { aux: true, dashed: true });
    g.segment(U, Z, { aux: true, dashed: true });
    // the twenty vertices: the cube's eight and two over each face
    const ridge = [-1, 1].flatMap((i) =>
      [-1, 1].flatMap((j) => [
        v3(i * (a + f), j * f, 0),
        v3(j * f, 0, i * (a + f)),
        v3(0, i * (a + f), j * f),
      ]),
    );
    const pts: V[] = [...cube, ...ridge];
    const faces = hullFaces(pts);
    if (whole >= 0.5) for (const fc of faces) g.polygon(fc.map((i) => pts[i]), { aux: true });
    g.polygon([U, B, W, C, Vv], { fill: true });
    const seen = new Set<string>();
    const edges: [number, number][] = [];
    for (const fc of faces)
      for (let i = 0; i < fc.length; i++) {
        const x = fc[i];
        const y = fc[(i + 1) % fc.length];
        const k = `${Math.min(x, y)},${Math.max(x, y)}`;
        if (!seen.has(k)) {
          seen.add(k);
          edges.push([x, y]);
        }
      }
    const Rs = a * Math.sqrt(3);
    g.sphere(Z, Rs, { aux: true });
    g.claim('12 faces, each a pentagon', faces.length === 12 && faces.every((fc) => fc.length === 5));
    const e = checkSolid(g, 'dodecahedron', pts, edges, Z, Rs, 30);
    g.equal('BU = UV', dist(B, U), dist(U, Vv));
    g.equal('BV = BC', dist(B, Vv), dist(B, C));
    g.claim('UBWCV is in one plane', planeDist(W, U, B, C) < 1e-9 && planeDist(Vv, U, B, C) < 1e-9);
    g.claim('XHW is a straight line', collinear(X, H, W));
    g.equal('UZ = radius of the sphere about the cube', dist(U, Z), dist(B, Z));
    g.equal('NO : UV = UV : (NO − UV)', dist(N, O) / dist(U, Vv), dist(U, Vv) / (dist(N, O) - dist(U, Vv)));
    g.show('side ÷ diameter', (e / (2 * Rs)).toFixed(6));
  },
});
