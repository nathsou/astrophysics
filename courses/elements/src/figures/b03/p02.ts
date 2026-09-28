import { figure } from '../../geometry/figure';
import { add, dist, lerp, mid, mul, sub, unit, v } from '../../geometry/vec';
import { arc3, need } from './lib';

// A chord lies inside its circle. The dashed curve AEB is the supposed line falling outside;
// D is the centre, and DFE the line from the centre through F on the circle to E on that curve.
export default figure({
  build(g) {
    const D = g.point('D', v(0, 0));
    const k = g.circle(D, 2);
    const A = g.glider('A', k, (200 * Math.PI) / 180);
    const B = g.glider('B', k, (300 * Math.PI) / 180);
    need(dist(A, B) > 0.4 && dist(A, B) < 3.9, 'A, B neither too close nor opposite');
    g.point('C', v(0, 2));
    // the impossible "straight line" AEB: an arc bulging outside the circle
    const m = mid(A, B);
    const out = unit(sub(m, D));
    const E = g.point('E', add(m, mul(out, 2 - dist(D, m) + 0.45)));
    arc3(g, A, E, B, { dashed: true });
    const F = g.point('F', add(D, mul(unit(sub(E, D)), 2)));
    g.segment(A, B);
    g.segment(D, A);
    g.segment(D, B);
    g.segment(D, E);
    void F;
    // every point of the chord AB is nearer to D than the radius
    let far = 0;
    for (let i = 1; i < 20; i++) far = Math.max(far, dist(D, lerp(A, B, i / 20)));
    g.claim('every point of AB is within the circle', far < 2);
    g.claim('DE > DF: E is outside', dist(D, E) > dist(D, F));
  },
});
