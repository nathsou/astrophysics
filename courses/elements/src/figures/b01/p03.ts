import { figure } from '../../geometry/figure';
import { Degenerate, add, along, dist, polar, rot, sub, unit, mul, v } from '../../geometry/vec';

// I.3: C is the given lesser line, drawn apart (its length is the slider). AD is C copied to A by
// I.2 (drawn as its result), and the circle DEF cuts AE off AB.
export default figure({
  build(g) {
    const c = g.param('c', 1.1, { min: 0.3, max: 2.4, label: 'length of C' });
    const A = g.free('A', -1, 0);
    const B = g.free('B', 1.6, -0.2);
    if (dist(A, B) <= c) throw new Degenerate('C must be the less');
    const u = unit(sub(B, A));
    // the given line C, drawn above and to the left of the figure
    const c0 = add(A, v(-0.4 - c, 1.5));
    g.segment(c0, add(c0, v(c, 0)), { name: 'C' });
    // (a segment's `text` is not drawn by the view, so the letter is a text element)
    g.text(add(c0, v(c / 2 - 0.05, 0.12)), 'C');
    g.segment(A, B);
    const D = g.point('D', add(A, mul(rot(u, 2.1), c)));
    g.segment(A, D);
    g.circle(A, D, { aux: true });
    const E = g.point('E', along(A, B, c));
    g.point('F', polar(A, c, Math.atan2(u.y, u.x) - 2.2));
    g.equal('AE = C', dist(A, E), c);
    g.claim('E lies between A and B', dist(A, E) < dist(A, B));
  },
});
