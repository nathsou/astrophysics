import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { onCircle, v3 } from './lib';

// Equal cylinders AO and EP on the circles ABCD and EFGH (diameters AC, EG), with axes KL and MN
// (L, N the centres of the bases). The radius of EFGH is chosen and the height MN is computed so
// that the cylinders are equal. QN is cut off equal to KL, and the plane TUS through Q cuts off the
// cylinder ES.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: 0.32 },
  build(g) {
    const h1 = g.param('h', 1.3, { min: 0.9, max: 1.6, label: 'height KL' });
    const r2 = g.param('r', 0.85, { min: 0.65, max: 1.05, label: 'radius of EFGH' });
    const r1 = 1.25;
    const h2 = (h1 * r1 * r1) / (r2 * r2);
    const up = v3(0, 0, 1);
    const L = g.point('L', v3(-2, 0, 0));
    const K = g.point('K', v3(-2, 0, h1));
    const N = g.point('N', v3(1.7, 0, 0));
    const M = g.point('M', v3(1.7, 0, h2));
    const Q = g.point('Q', v3(1.7, 0, h1));
    const t = Math.PI;
    const on = (c: typeof L, r: number, a: number, z = 0) => v3(onCircle(c, r, a).x, onCircle(c, r, a).y, (c.z ?? 0) + z);
    const A = g.point('A', on(L, r1, t));
    g.point('B', on(L, r1, t + Math.PI / 2));
    const C = g.point('C', on(L, r1, t + Math.PI));
    g.point('D', on(L, r1, t - Math.PI / 2));
    const E = g.point('E', on(N, r2, t));
    g.point('F', on(N, r2, t + Math.PI / 2));
    const G = g.point('G', on(N, r2, t + Math.PI));
    g.point('H', on(N, r2, t - Math.PI / 2));
    const O = g.point('O', on(K, r1, t + Math.PI));
    const R = g.point('R', on(M, r2, t));
    const P = g.point('P', on(M, r2, t + Math.PI));
    const T = g.point('T', on(Q, r2, t));
    g.point('U', on(Q, r2, t + (3 * Math.PI) / 2));
    const S = g.point('S', on(Q, r2, t + Math.PI));
    g.circle3(L, up, r1);
    g.circle3(K, up, r1);
    g.circle3(N, up, r2);
    g.circle3(M, up, r2);
    g.circle3(Q, up, r2, { dashed: true });
    g.segment(A, C, { aux: true });
    g.segment(E, G, { aux: true });
    g.segment(K, L, { aux: true, dashed: true });
    g.segment(M, N, { aux: true, dashed: true });
    g.polygon([A, C, O, on(K, r1, t)], { fill: true, name: 'AO' });
    g.polygon([E, G, P, R], { aux: true, name: 'EP' });
    g.polygon([E, G, S, T], { fill: true, name: 'ES' });
    const cyl = (r: number, h: number) => Math.PI * r * r * h;
    const circ = (r: number) => Math.PI * r * r;
    g.equal('cylinder AO = cylinder EP', cyl(r1, dist(K, L)), cyl(r2, dist(M, N)));
    g.equal('QN = KL', dist(Q, N), dist(K, L));
    g.equal('ABCD : EFGH = MN : KL', circ(r1) / circ(r2), dist(M, N) / dist(K, L));
  },
});
