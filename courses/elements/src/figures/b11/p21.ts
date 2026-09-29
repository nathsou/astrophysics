import { figure } from '../../geometry/figure';
import { angle, deg } from '../../geometry/vec';
import { v3 } from './lib';

// The face angles of a solid angle add up to less than four right angles. Lower A towards the
// base: the sum approaches 360°, and the solid angle flattens out.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.22 },
  build(g) {
    const h = g.param('h', 1.4, { min: 0.12, max: 2.6, label: 'height of A' });
    const ax = g.param('ax', 0.15, { min: -0.5, max: 0.6, label: 'position of A' });
    const B = g.point('B', v3(-1.5, -0.6, 0));
    const C = g.point('C', v3(1.5, -0.9, 0));
    const D = g.point('D', v3(0.2, 1.3, 0));
    const A = g.point('A', v3(ax, 0, h));
    g.polygon([B, C, D], { fill: true });
    g.polygon([A, B, C], { fill: true });
    g.polygon([A, C, D], { fill: true });
    g.polygon([A, D, B], { fill: true });
    const at = (p: typeof A, q: typeof A, r: typeof A) => deg(angle(p, q, r));
    const top = at(B, A, C) + at(C, A, D) + at(D, A, B);
    const six = at(C, B, A) + at(A, B, D) + at(B, C, A) + at(A, C, D) + at(C, D, A) + at(A, D, B);
    g.show('∠BAC + ∠CAD + ∠DAB', `${top.toFixed(1)}°`);
    g.claim('the six base angles of the side faces > 180°', six > 180);
    g.claim('∠BAC + ∠CAD + ∠DAB < 360°', top < 360);
  },
});
