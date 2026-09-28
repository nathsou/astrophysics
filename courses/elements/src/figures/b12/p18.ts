import { figure } from '../../geometry/figure';
import { add, dist, type V } from '../../geometry/vec';
import { globe, v3 } from './lib';

// Spheres ABC and DEF with diameters BC and EF. GHK is the supposed lesser sphere about the centre
// of DEF, LMN the supposed greater one. Similar polyhedra (XII.17) are inscribed in ABC and DEF;
// the slider refines them. Their volumes are always in the triplicate ratio of the diameters, and
// they fill more and more of the spheres.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: 0.35 },
  build(g) {
    const s = g.param('s', 0.62, { min: 0.35, max: 0.9, label: 'EF ÷ BC' });
    const k = g.param('k', 3, { min: 1, max: 6, label: 'divisions of a quadrant' });
    const w = g.param('w', 0.88, { min: 0.6, max: 0.97, label: 'GHK ÷ DEF (radii)' });
    const R1 = 1.6;
    const R2 = s * R1;
    const c1 = v3(-2.2, 0, 0);
    const c2 = v3(1.6, 0, 0);
    const pt = (c: V, r: number, lon: number, lat: number) => add(c, v3(r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)));
    const B = g.point('B', pt(c1, R1, Math.PI, 0));
    const C = g.point('C', pt(c1, R1, 0, 0));
    g.point('A', pt(c1, R1, 0, Math.PI / 2));
    const E = g.point('E', pt(c2, R2, Math.PI, 0));
    const F = g.point('F', pt(c2, R2, 0, 0));
    g.point('D', pt(c2, R2, 0, Math.PI / 2));
    const rg = w * R2;
    const rl = R2 / w;
    g.point('G', pt(c2, rg, -2.2, 0.5), { hidden: true });
    g.point('H', pt(c2, rg, -1.2, 0.2), { hidden: true });
    g.point('K', pt(c2, rg, -0.4, 0.6), { hidden: true });
    g.point('L', pt(c2, rl, 2.2, 0.3), { hidden: true });
    g.point('M', pt(c2, rl, 1.2, 0.5), { hidden: true });
    g.point('N', pt(c2, rl, 0.4, 0.2), { hidden: true });
    g.sphere(c1, R1, { name: 'ABC' });
    g.sphere(c2, R2, { name: 'DEF' });
    g.sphere(c2, rg, { aux: true, dashed: true, name: 'GHK' });
    g.sphere(c2, rl, { aux: true, dashed: true, name: 'LMN' });
    g.segment(B, C, { aux: true });
    g.segment(E, F, { aux: true });
    const up = v3(0, 0, 1);
    g.circle3(c1, up, R1, { aux: true });
    g.circle3(c2, up, R2, { aux: true });
    const poly = (c: V, r: number) => {
      const gl = globe(c, r, k);
      for (let i = 0; i < gl.m; i++) g.curve(Array.from({ length: 2 * k + 1 }, (_, j) => gl.P(i, Math.abs(j - k), j < k ? -1 : 1)), { aux: true });
      for (let j = 0; j < k; j++) for (const sg of [1, -1]) g.curve(Array.from({ length: gl.m }, (_, i) => gl.P(i, j, sg)), { aux: true, closed: true });
      return gl;
    };
    const p1 = poly(c1, R1);
    const p2 = poly(c2, R2);
    const ball = (r: number) => (4 / 3) * Math.PI * r ** 3;
    g.equal('polyhedron in ABC : polyhedron in DEF = (BC : EF)³', p1.vol / p2.vol, (dist(B, C) / dist(E, F)) ** 3);
    g.show('polyhedron ÷ its sphere', (p1.vol / ball(R1)).toFixed(5));
    g.show('sphere GHK ÷ sphere DEF', (w ** 3).toFixed(5));
    g.show(`polyhedron in DEF ${p2.vol > ball(rg) ? '>' : '≤'} sphere GHK`, (p2.vol / ball(rg)).toFixed(4));
    g.equal('sphere ABC : sphere DEF = (BC : EF)³', ball(R1) / ball(R2), (dist(B, C) / dist(E, F)) ** 3);
  },
});
