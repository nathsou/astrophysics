import { figure } from '../../geometry/figure';
import { angle, deg, dist, foot } from '../../geometry/vec';
import { Degenerate } from '../../geometry/vec';

// The law of cosines, acute case: AC² = CB² + BA² − 2·CB·BD, where BD = BA·cos B.
export default figure({
  build(g) {
    const A = g.free('A', -0.6, 2.6);
    const B = g.free('B', -2, 0);
    const C = g.free('C', 2.4, 0);
    const b = angle(A, B, C);
    if (b >= Math.PI / 2 - 0.02) throw new Degenerate('the angle at B must be acute');
    const D = g.point('D', foot(A, B, C));
    g.polygon([A, B, C]);
    g.segment(A, D);
    g.angle(A, D, C, { right: true });
    g.angle(A, B, C);
    const cb = dist(C, B);
    const ba = dist(B, A);
    const bd = dist(B, D);
    g.claim('∠ABC is acute', deg(b) < 90);
    g.equal('AC² = CB² + BA² − 2·CB·BD', dist(A, C) ** 2, cb * cb + ba * ba - 2 * cb * bd);
    g.equal('AC² = CB² + BA² − 2·CB·BA·cos B', dist(A, C) ** 2, cb * cb + ba * ba - 2 * cb * ba * Math.cos(b));
  },
});
