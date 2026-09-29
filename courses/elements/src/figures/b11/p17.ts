import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { isParallel, linePlane, sub, v3, Z3 } from './lib';

// Two lines cut by three parallel planes are cut in the same ratio.
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: -0.3 },
  build(g) {
    const z2 = g.param('z2', 0.9, { min: 0.35, max: 1.8, label: 'height of the plane KL' });
    const ax = g.param('ax', -0.9, { min: -1.4, max: -0.4, label: 'foot of AB' });
    const cx = g.param('cx', 0.5, { min: 0.1, max: 1.1, label: 'foot of CD' });
    const z1 = 2.2;
    const quad = (z: number, name: string) => g.polygon([v3(-2, -1.1, z), v3(2, -1.1, z), v3(2, 1.1, z), v3(-2, 1.1, z)], { fill: true, aux: true, name });
    quad(z1, 'GH');
    quad(z2, 'KL');
    quad(0, 'MN');
    const A = g.point('A', v3(-1.3, 0.1, z1));
    const B = g.point('B', v3(ax, -0.5, 0));
    const C = g.point('C', v3(0.6, 0.4, z1));
    const D = g.point('D', v3(cx + 0.9, -0.3, 0));
    const at = (p: ReturnType<typeof v3>, q: ReturnType<typeof v3>) => linePlane(p, q, v3(0, 0, z2), Z3);
    const E = g.point('E', at(A, B));
    const F = g.point('F', at(C, D));
    const O = g.point('O', at(A, D));
    g.segment(A, B, { colour: 'red' });
    g.segment(C, D, { colour: 'blue' });
    g.segment(A, C, { aux: true });
    g.segment(B, D, { aux: true });
    g.segment(A, D, { aux: true });
    g.segment(E, O, { aux: true });
    g.segment(O, F, { aux: true });
    g.equal('AE : EB = CF : FD', dist(A, E) / dist(E, B), dist(C, F) / dist(F, D));
    g.equal('AE : EB = AO : OD', dist(A, E) / dist(E, B), dist(A, O) / dist(O, D));
    g.claim('EO ∥ BD and OF ∥ AC', isParallel(sub(O, E), sub(D, B)) && isParallel(sub(F, O), sub(C, A)));
  },
});
