import { figure } from '../../geometry/figure';
import { add, dist, mid, type V } from '../../geometry/vec';
import { checkSolid, diameter, v3 } from './lib';

// The icosahedron in a sphere. On the left, the diameter AB cut at C with AC = 4CB, the semicircle
// ADB and DB. On the right, the circle EFGHK with radius DB and centre V, the pentagon EFGHK, and
// L, M, N, O, P the midpoints of its arcs (so LMNOP is a pentagon and EP a side of the decagon).
// EQ, FR, GS, HT, KU stand at right angles to the circle, equal to its radius; VW is the radius set
// up at V, and WZ, VX are sides of the decagon. The icosahedron has the vertices Z, QRSTU, LMNOP, X.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: 0.42 },
  build(g) {
    const d = g.param('d', 3.2, { min: 2, max: 4, label: 'diameter AB' });
    const R = d / 2;
    const dg = diameter(g, v3(-R, 0, -R - 0.5), d, 4 / 5, {}, -1);
    g.segment(dg.D, dg.B);
    const r = dg.DB;
    const s10 = 2 * r * Math.sin(Math.PI / 10);
    // the sphere's centre is the midpoint of XZ; place it at the origin
    const zc = -r / 2;
    const Vp = g.point('V', v3(0, 0, zc));
    const t0 = (-100 * Math.PI) / 180;
    const circ = (k: number, z = zc) => v3(r * Math.cos(t0 + (k * Math.PI) / 5), r * Math.sin(t0 + (k * Math.PI) / 5), z);
    const names = ['E', 'L', 'F', 'M', 'G', 'N', 'H', 'O', 'K', 'P'];
    const P: Record<string, V> = {};
    names.forEach((n, i) => (P[n] = g.point(n, circ(i))));
    const top = ['Q', 'R', 'S', 'T', 'U'];
    ['E', 'F', 'G', 'H', 'K'].forEach((n, i) => (P[top[i]] = g.point(top[i], add(P[n], v3(0, 0, r)))));
    const W = g.point('W', add(Vp, v3(0, 0, r)));
    const Z = g.point('Z', add(W, v3(0, 0, s10)));
    const X = g.point('X', add(Vp, v3(0, 0, -s10)));
    g.point("A'", mid(Vp, W));
    const O = v3(0, 0, 0);
    g.sphere(O, R, { aux: true });
    g.circle3(Vp, v3(0, 0, 1), r, { aux: true });
    g.polygon(['E', 'F', 'G', 'H', 'K'].map((n) => P[n]), { aux: true });
    for (let i = 0; i < 5; i++) g.segment(P['EFGHK'[i]], P[top[i]], { aux: true });
    g.segment(X, Z, { aux: true, dashed: true });
    g.segment(P.E, Vp, { aux: true });
    g.segment(P.E, P.P, { aux: true });
    g.segment(P.Q, W, { aux: true });
    // the twenty faces
    const up = top.map((n) => P[n]);
    const low = ['L', 'M', 'N', 'O', 'P'].map((n) => P[n]);
    const faces: V[][] = [];
    for (let i = 0; i < 5; i++) {
      const j = (i + 1) % 5;
      faces.push([Z, up[i], up[j]]);
      faces.push([up[i], low[i], up[j]]);
      faces.push([low[i], up[j], low[j]]);
      faces.push([X, low[i], low[j]]);
    }
    for (const f of faces) g.polygon(f, { fill: true });
    const pts = [Z, ...up, ...low, X];
    const idx = (p: V) => pts.indexOf(p);
    const seen = new Set<string>();
    const edges: [number, number][] = [];
    for (const f of faces)
      for (let i = 0; i < 3; i++) {
        const a = idx(f[i]);
        const b = idx(f[(i + 1) % 3]);
        const k = `${Math.min(a, b)},${Math.max(a, b)}`;
        if (!seen.has(k)) {
          seen.add(k);
          edges.push([a, b]);
        }
      }
    const e = checkSolid(g, 'icosahedron', pts, edges, O, R, 30);
    g.equal('XZ = AB', dist(X, Z), d);
    g.equal('side = side of the pentagon in EFGHK', e, dist(P.E, P.F));
    g.equal('□AB = 5 □(radius of EFGHK)', d * d, 5 * r * r);
    g.equal('ZV : VW = VW : WZ', dist(Z, Vp) / dist(Vp, W), dist(Vp, W) / dist(W, Z));
    g.show('side ÷ diameter', (e / d).toFixed(6));
  },
});
