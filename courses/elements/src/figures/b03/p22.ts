import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { ccw, degAt, dirOf, need } from './lib';

// The opposite angles of a quadrilateral inscribed in a circle add up to two right angles.
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = g.circle(O, 2);
    const rad = Math.PI / 180;
    const A = g.glider('A', k, 128 * rad);
    const B = g.glider('B', k, 208 * rad);
    const C = g.glider('C', k, 305 * rad);
    const D = g.glider('D', k, 40 * rad);
    const t = (P: typeof A) => ccw(dirOf(O, A), dirOf(O, P));
    need(t(B) > 0.05 && t(C) > t(B) + 0.05 && t(D) > t(C) + 0.05 && t(D) < 2 * Math.PI - 0.05, 'A, B, C, D in order round the circle');
    g.polygon([A, B, C, D]);
    g.segment(A, C, { aux: true });
    g.segment(B, D, { aux: true });
    g.angle(A, B, C);
    g.angle(A, D, C);
    g.equal('∠ABC + ∠ADC = 180°', degAt(A, B, C) + degAt(A, D, C), 180);
    g.equal('∠BAD + ∠DCB = 180°', degAt(B, A, D) + degAt(D, C, B), 180);
  },
});
