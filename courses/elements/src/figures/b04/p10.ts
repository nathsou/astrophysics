import { figure } from '../../geometry/figure';
import { angle, circumcircle, deg, dist, foot, rotAbout } from '../../geometry/vec';
import { goldenTriangle } from './lib';

// The golden triangle ABD: C cuts AB in extreme and mean ratio (II.11), BD = AC is fitted into
// the circle BDE (IV.1), and BD touches the circle ACD (III.37), which forces ∠ABD = ∠ADB = 2∠BAD.
export default figure({
  build(g) {
    const A = g.free('A', 0, 1.6);
    const B = g.free('B', -0.93, -1.25);
    const t = goldenTriangle(A, B);
    const C = g.point('C', t.C);
    const D = g.point('D', t.D);
    g.circle(A, B);
    g.point('E', rotAbout(B, A, -2.2));
    g.segment(A, B);
    g.segment(A, D);
    g.segment(B, D);
    g.segment(D, C);
    const k = circumcircle(A, C, D);
    g.circle(k.c, k.r, { aux: true });
    g.angle(B, A, D);
    g.angle(A, B, D);
    g.angle(B, D, A);
    const bad = deg(angle(B, A, D));
    g.equal('AB·BC = AC²', dist(A, B) * dist(B, C), dist(A, C) ** 2);
    g.equal('BD touches the circle ACD', dist(foot(k.c, B, D), k.c), k.r);
    g.equal('∠ABD = 2∠BAD', deg(angle(A, B, D)), 2 * bad);
    g.equal('∠ADB = 2∠BAD', deg(angle(A, D, B)), 2 * bad);
    g.equal('∠BAD = 36°', bad, 36);
    g.equal('CD = CA = BD', dist(C, D), dist(C, A));
  },
});
