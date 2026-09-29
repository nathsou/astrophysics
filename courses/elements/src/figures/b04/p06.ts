import { figure } from '../../geometry/figure';
import { angle, deg, dist, lc, rotAbout } from '../../geometry/vec';

// The inscribed square: two perpendicular diameters AC and BD.
export default figure({
  build(g) {
    const E = g.free('E', 0, 0);
    const A = g.free('A', 0.5, 1.9);
    const k = g.circle(E, A);
    const C = g.point('C', lc(A, E, k)[1]);
    const B = g.point('B', rotAbout(A, E, Math.PI / 2));
    const D = g.point('D', lc(B, E, k)[1]);
    g.segment(A, C);
    g.segment(B, D);
    g.polygon([A, B, C, D]);
    g.angle(A, E, B, { right: true });
    g.equal('AB = BC', dist(A, B), dist(B, C));
    g.equal('CD = DA', dist(C, D), dist(D, A));
    g.equal('AB = AD', dist(A, B), dist(A, D));
    g.equal('∠BAD = 90°', deg(angle(B, A, D)), 90);
    g.equal('∠ABC = 90°', deg(angle(A, B, C)), 90);
  },
});
