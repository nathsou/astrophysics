import { figure } from '../../geometry/figure';
import { add, dist, ll, mid, mul, perp, rot, sub, unit, cross2 } from '../../geometry/vec';
import { arc3, degAt, need } from './lib';

// Given a segment ABC of a circle, complete the circle: bisect AC at D, erect DB, and make the angle
// BAE equal to ABD; E, on DB, is the centre. Drag B to change the segment: E falls outside the
// segment (less than a semicircle), at D (a semicircle), or inside it (greater than a semicircle).
export default figure({
  build(g) {
    const A = g.free('A', -2.2, -0.8);
    const C = g.free('C', 2.2, -0.8);
    const D = g.point('D', mid(A, C));
    const n = unit(perp(sub(C, A)));
    const h = dist(A, D);
    const B = g.glider('B', [D, add(D, mul(n, h))], 0.6, { line: true });
    need(dist(B, D) > 0.05 * h, 'B off AC');
    arc3(g, A, B, C, { name: 'ABC' });
    const a = (degAt(A, B, D) * Math.PI) / 180;
    const s = Math.sign(cross2(sub(B, A), sub(D, A)));
    const E = g.point('E', ll(A, add(A, rot(sub(B, A), s * a)), D, B));
    g.circle(E, A, { aux: true, dashed: true });
    g.segment(A, C);
    g.segment(D, B);
    g.segment(A, B);
    g.segment(D, E, { aux: true });
    g.segment(A, E);
    g.segment(E, C);
    g.angle(A, D, B, { right: true });
    g.equal('EA = EB', dist(E, A), dist(E, B));
    g.equal('EB = EC', dist(E, B), dist(E, C));
    const abd = degAt(A, B, D), bad = degAt(B, A, D);
    g.show('case', Math.abs(abd - bad) < 0.05 ? '∠ABD = ∠BAD: a semicircle' : abd > bad ? '∠ABD > ∠BAD: less than a semicircle' : '∠ABD < ∠BAD: greater than a semicircle');
  },
});
