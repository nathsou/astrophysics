import { figure } from '../../geometry/figure';
import { add, angle, area, dist, sub } from '../../geometry/vec';

// The parallelogram ACDB (A, B above; C, D below), built from three free vertices; BC is the
// diameter (diagonal) that cuts it into the triangles ABC and DCB.
export default figure({
  build(g) {
    const A = g.free('A', -1.7, 1.3);
    const B = g.free('B', 2.3, 1.3);
    const C = g.free('C', -2.7, -1.1);
    const D = g.point('D', add(C, sub(B, A)));
    g.polygon([A, B, D, C]);
    g.polygon([A, B, C], { fill: true, aux: true });
    g.segment(B, C);
    g.angle(B, A, C);
    g.angle(C, D, B);
    g.equal('AB = CD', dist(A, B), dist(C, D));
    g.equal('AC = BD', dist(A, C), dist(B, D));
    g.equal('∠BAC = ∠CDB', angle(B, A, C), angle(C, D, B));
    g.equal('∠ABD = ∠ACD', angle(A, B, D), angle(A, C, D));
    g.equal('△ABC = △DCB', area([A, B, C]), area([D, C, B]));
  },
});
