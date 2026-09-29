import { figure } from '../../geometry/figure';
import { add, dist, ll, sub, unit, angle } from '../../geometry/vec';

// AD bisects the angle BAC; CE is drawn parallel to DA and meets BA produced at E.
export default figure({
  build(g) {
    const A = g.free('A', 0.2, 0.6);
    const B = g.free('B', -2.4, -0.8);
    const C = g.free('C', 1.4, -0.8);
    const dir = add(unit(sub(B, A)), unit(sub(C, A)));
    const D = g.point('D', ll(A, add(A, dir), B, C));
    const E = g.point('E', ll(B, A, C, add(C, dir)));
    g.polygon([A, B, C]);
    g.segment(A, D, { colour: 'red' });
    g.segment(A, E, { aux: true });
    g.segment(C, E, { aux: true });
    g.angle(B, A, D);
    g.angle(D, A, C);
    g.equal('BD : DC = BA : AC', dist(B, D) / dist(D, C), dist(B, A) / dist(A, C));
    g.equal('AE = AC', dist(A, E), dist(A, C));
    g.equal('∠ACE = ∠AEC', angle(A, C, E), angle(A, E, C));
  },
});
