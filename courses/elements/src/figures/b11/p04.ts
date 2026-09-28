import { figure } from '../../geometry/figure';
import { angle, deg, dist, lerp } from '../../geometry/vec';
import { dot, ground, mul, sph, sub, v3 } from './lib';

// A line perpendicular to two intersecting lines at their common point is perpendicular to their
// plane. EF stands at E, perpendicular to AB and CD; GEH is any other line through E in the plane.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.38 },
  build(g) {
    const gam = g.param('gam', 1.25, { min: 0.7, max: 2.3, label: 'angle between AB and CD' });
    const s = g.param('s', 0.38, { min: 0.12, max: 0.88, label: 'direction of GH' });
    const h = g.param('h', 1.7, { min: 1, max: 2.4, label: 'height of F' });
    const r = 1.5;
    ground(g, -1.9, 1.9, -1.6, 1.6);
    const E = g.point('E', v3(0, 0, 0));
    const b = sph(-0.3);
    const c = sph(-0.3 + gam);
    const B = g.point('B', mul(b, r));
    const A = g.point('A', mul(b, -r));
    const C = g.point('C', mul(c, r));
    const D = g.point('D', mul(c, -r));
    const Gv = lerp(A, D, s);
    const Gp = g.point('G', Gv);
    const H = g.point('H', mul(Gv, -1));
    const F = g.point('F', v3(0, 0, h));
    g.segment(A, B);
    g.segment(C, D);
    g.segment(Gp, H, { colour: 'blue' });
    g.segment(A, D, { aux: true });
    g.segment(C, B, { aux: true });
    g.segment(E, F, { colour: 'red' });
    for (const X of [A, Gp, D, C, H, B]) g.segment(F, X, { aux: true });
    g.angle(Gp, E, F, { right: true });
    g.equal('FA = FB', dist(F, A), dist(F, B));
    g.equal('FG = FH', dist(F, Gp), dist(F, H));
    g.equal('EF · GH = 0 (∠GEF right)', dot(sub(F, E), sub(H, Gp)), 0);
    g.equal('∠GEF = 90°', deg(angle(Gp, E, F)), 90);
  },
});
