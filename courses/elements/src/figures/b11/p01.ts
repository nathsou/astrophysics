import { figure } from '../../geometry/figure';
import { angle, deg } from '../../geometry/vec';
import { distLine, ground, v3, Z3 } from './lib';

// A part of a straight line cannot lie in a plane and a part above it.
// The reductio: AB lies in the plane of reference, BC rises above it, and BD continues AB in the
// plane. If ABC were straight, AB would be a common segment of two straight lines ABC and ABD.
export default figure({
  dim: 3,
  camera: { yaw: -0.35, pitch: -0.4 },
  build(g) {
    const e = g.param('e', 0.55, { min: 0.15, max: 1.1, label: 'rise of BC' });
    ground(g, -2.2, 2.2, -1.4, 1.4);
    const A = g.point('A', v3(-1.7, 0, 0));
    const B = g.point('B', v3(0, 0, 0));
    const D = g.point('D', v3(1.7, 0, 0));
    const C = g.point('C', v3(1.7 * Math.cos(e), 0, 1.7 * Math.sin(e)));
    g.segment(A, B);
    g.segment(B, D);
    g.segment(B, C, { dashed: true });
    // the circle with centre B and distance AB, in the plane of reference
    g.circle3(B, Z3, 1.7, { aux: true });
    g.equal('∠ABD = 180° (ABD straight)', deg(angle(A, B, D)), 180);
    g.claim('C is not on the line ABD', distLine(C, A, D) > 0.1);
    g.show('∠ABC', `${deg(angle(A, B, C)).toFixed(1)}°`);
  },
});
