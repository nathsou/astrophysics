import { figure } from '../../geometry/figure';
import { dot, sub } from '../../geometry/vec';
import { add, footPlane, ground, isParallel, mul, v3, X3, Y3, Z3 } from './lib';

// At a point of a plane, set up the perpendicular: drop one from any point above (XI.11) and draw
// the parallel to it through the given point.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: -0.35 },
  build(g) {
    const bx = g.param('bx', 0.9, { min: 0.3, max: 1.5, label: 'position of B' });
    const hb = g.param('hb', 1.7, { min: 1, max: 2.3, label: 'height of B' });
    const hd = g.param('hd', 1.3, { min: 0.6, max: 2, label: 'AD' });
    ground(g, -1.9, 2.1, -1.4, 1.4);
    const A = g.point('A', v3(-0.9, -0.3, 0));
    const B = g.point('B', v3(bx, 0.5, hb));
    const C = g.point('C', footPlane(B, v3(0, 0, 0), Z3));
    // AD parallel to CB, through A
    const D = g.point('D', add(A, mul(sub(B, C), hd / hb)));
    g.segment(B, C, { colour: 'blue' });
    g.segment(A, D, { colour: 'red' });
    g.segment(A, C, { aux: true });
    g.angle(B, C, A, { right: true });
    g.angle(D, A, C, { right: true });
    g.claim('AD ∥ BC', isParallel(sub(D, A), sub(B, C)));
    g.equal('AD ⊥ the plane (AD · x = AD · y = 0)', Math.abs(dot(sub(D, A), X3)) + Math.abs(dot(sub(D, A), Y3)), 0);
  },
});
