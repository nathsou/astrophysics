import { figure } from '../../geometry/figure';
import { angle, deg, dist, foot } from '../../geometry/vec';
import { Degenerate } from '../../geometry/vec';

// The law of cosines, obtuse case: BC² = BA² + AC² + 2·CA·AD, where AD = AB·cos(180° − A).
export default figure({
  build(g) {
    const B = g.free('B', -1.7, 2.3);
    const A = g.free('A', -0.5, 0);
    const C = g.free('C', 2.6, 0);
    const a = angle(B, A, C);
    if (a <= Math.PI / 2 + 0.02) throw new Degenerate('the angle BAC must be obtuse');
    const D = g.point('D', foot(B, C, A));
    g.polygon([A, B, C]);
    g.segment(A, D, { dashed: true });
    g.segment(B, D);
    g.angle(B, D, A, { right: true });
    g.angle(B, A, C);
    const ab = dist(A, B);
    const ac = dist(A, C);
    const ad = dist(A, D);
    g.claim('∠BAC is obtuse', deg(a) > 90);
    g.equal('BC² = BA² + AC² + 2·CA·AD', dist(B, C) ** 2, ab * ab + ac * ac + 2 * ac * ad);
    g.equal('BC² = BA² + AC² − 2·BA·AC·cos A', dist(B, C) ** 2, ab * ab + ac * ac - 2 * ab * ac * Math.cos(a));
    g.equal('DC² = CA² + AD² + 2·CA·AD  (II.4)', dist(D, C) ** 2, ac * ac + ad * ad + 2 * ac * ad);
  },
});
