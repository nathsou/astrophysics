import { figure } from '../../geometry/figure';
import { add, angle, deg, mul, sub, unit } from '../../geometry/vec';

// The angle sum. ABC is any triangle; BC is produced to D, and CE is drawn through C parallel to
// AB (I.31). The exterior angle ACD splits into ACE (= BAC, alternate) and ECD (= ABC, corresponding).
export default figure({
  build(g) {
    const A = g.free('A', -0.5, 1.9);
    const B = g.free('B', -2.6, -1);
    const C = g.free('C', 1.2, -1);
    const D = g.point('D', add(C, mul(unit(sub(C, B)), 2)));
    const E = g.point('E', add(C, mul(unit(sub(A, B)), 2)));
    g.polygon([A, B, C]);
    g.segment(C, D);
    g.segment(C, E);
    g.angle(C, A, B);
    g.angle(A, B, C);
    g.angle(A, C, E);
    g.angle(E, C, D);
    const a = angle(C, A, B);
    const b = angle(A, B, C);
    const c = angle(B, C, A);
    g.equal('∠ACE = ∠BAC', angle(A, C, E), a);
    g.equal('∠ECD = ∠ABC', angle(E, C, D), b);
    g.equal('∠ACD = ∠CAB + ∠ABC', angle(A, C, D), a + b);
    g.equal('∠ABC + ∠BCA + ∠CAB = 2 right angles', a + b + c, Math.PI);
    g.show('angle sum', `${deg(a).toFixed(1)}° + ${deg(b).toFixed(1)}° + ${deg(c).toFixed(1)}° = ${deg(a + b + c).toFixed(1)}°`);
  },
});
