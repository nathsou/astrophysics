import { figure } from '../../geometry/figure';
import { add, isParallel, mul, sph, sub, v3, Z3 } from './lib';

// Two parallel planes cut by a third: the sections are parallel.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.35 },
  unresolved: {
    K: 'the supposed meeting point of EF and GH produced, which cannot exist',
    EFK: 'EF produced to the impossible point K',
  },
  build(g) {
    const h = g.param('h', 1.5, { min: 1, max: 2, label: 'distance between the planes' });
    const az = g.param('az', 0.2, { min: -0.4, max: 0.7, label: 'direction of the sections' });
    const lean = g.param('lean', 0.45, { min: -0.6, max: 0.9, label: 'lean of the cutting plane' });
    const s = 1.9;
    g.polygon([v3(-s, -1.4, h), v3(s, -1.4, h), v3(s, 1.4, h), v3(-s, 1.4, h)], { fill: true, aux: true, name: 'AB' });
    g.polygon([v3(-s, -1.4, 0), v3(s, -1.4, 0), v3(s, 1.4, 0), v3(-s, 1.4, 0)], { fill: true, aux: true, name: 'CD' });
    const L = sph(az);
    const m = mul(sph(az + Math.PI / 2), lean);
    const P = v3(0, -0.2, 0);
    const Q = add(add(P, mul(m, h)), mul(Z3, h));
    const E = g.point('E', sub(Q, mul(L, 1.3)));
    const F = g.point('F', add(Q, mul(L, 1.3)));
    const Gp = g.point('G', sub(P, mul(L, 1.3)));
    const H = g.point('H', add(P, mul(L, 1.3)));
    g.polygon([E, F, H, Gp], { fill: true });
    g.segment(E, F, { colour: 'red' });
    g.segment(Gp, H, { colour: 'red' });
    g.claim('EF ∥ GH', isParallel(sub(F, E), sub(H, Gp)));
  },
});
