import { figure } from '../../geometry/figure';
import { add, dist, lc, mid, perp, sub, v } from '../../geometry/vec';
import { degAt, need } from './lib';

// To find the centre of a given circle. The circle is given (its centre is not shown: that is what
// we are looking for); A and B glide on it, so the chord AB is "drawn at random". G is a would-be
// centre off the line CE, which the reader can drag: GA and GB are never equal there.
export default figure({
  build(g) {
    const k = { c: v(0, 0), r: 2 };
    g.circle(k.c, k.r, { name: 'ABC' });
    const A = g.glider('A', k, (205 * Math.PI) / 180);
    const B = g.glider('B', k, (330 * Math.PI) / 180);
    need(dist(A, B) > 0.2, 'A and B apart');
    const D = g.point('D', mid(A, B));
    // the perpendicular to AB at D meets the circle at C (the far end) and E (the near end)
    const [p, q] = lc(D, add(D, perp(sub(B, A))), k);
    const [Cp, Ep] = dist(p, D) > dist(q, D) ? [p, q] : [q, p];
    const C = g.point('C', Cp);
    const E = g.point('E', Ep);
    const F = g.point('F', mid(C, E));
    g.segment(A, B);
    g.segment(C, E);
    g.angle(F, D, B, { right: true });
    const G = g.free('G', 0.75, 0.3);
    g.segment(G, A, { dashed: true });
    g.segment(G, D, { dashed: true });
    g.segment(G, B, { dashed: true });
    g.equal('FA = FB', dist(F, A), dist(F, B));
    g.equal('FC = FA', dist(F, C), dist(F, A));
    g.claim('GA ≠ GB, so G is not the centre', Math.abs(dist(G, A) - dist(G, B)) > 1e-9);
    g.show('∠GDB', `${degAt(G, D, B).toFixed(1)}°`);
  },
});
